package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/openai"
	"github.com/Wei-Shaw/sub2api/internal/pkg/openai_compat"
	"github.com/Wei-Shaw/sub2api/internal/pkg/tlsfingerprint"
	"github.com/Wei-Shaw/sub2api/internal/util/urlvalidator"
	"github.com/tidwall/gjson"
)

const iqDetectionMaxErrorBodyBytes = 64 << 10

// OpenAIIQDetectionProber 使用与真实网关一致的 Codex OAuth / OpenAI Responses / Chat Completions
// 出站协议发起智商抽检，不产生 usage_logs 计费记录，也不修改账号调度状态。
type OpenAIIQDetectionProber struct {
	accountRepo         AccountRepository
	openaiTokenProvider *OpenAITokenProvider
	httpUpstream        HTTPUpstream
	cfg                 *config.Config
	tlsFPProfileService *TLSFingerprintProfileService
	pluginManager       *PluginManager
	agentIdentityWS     agentIdentityWSConnectionInvalidator
	agentIdentityTaskMu sync.Mutex
}

// NewOpenAIIQDetectionProber 构造 OpenAIIQDetectionProber。
func NewOpenAIIQDetectionProber(
	accountRepo AccountRepository,
	openaiTokenProvider *OpenAITokenProvider,
	httpUpstream HTTPUpstream,
	cfg *config.Config,
	tlsFPProfileService *TLSFingerprintProfileService,
	pluginManager *PluginManager,
	openaiGatewayService *OpenAIGatewayService,
) *OpenAIIQDetectionProber {
	p := &OpenAIIQDetectionProber{
		accountRepo:         accountRepo,
		openaiTokenProvider: openaiTokenProvider,
		httpUpstream:        httpUpstream,
		cfg:                 cfg,
		tlsFPProfileService: tlsFPProfileService,
		pluginManager:       pluginManager,
	}
	if openaiGatewayService != nil {
		p.agentIdentityWS = openaiGatewayService
	}
	return p
}

// ProbeAccount 对单个 OpenAI / Codex 账号发起一次标准推理题探测。
func (p *OpenAIIQDetectionProber) ProbeAccount(
	ctx context.Context,
	account *Account,
	model string,
	effort string,
	prompt string,
) (*IQDetectionProbeResult, error) {
	if account == nil {
		return nil, errors.New("account is nil")
	}
	if account.IsSyntheticUITest() {
		return &IQDetectionProbeResult{
			Protocol:        "synthetic",
			InputTokens:     168,
			OutputTokens:    420,
			ReasoningTokens: 312,
			ResponseModel:   model,
			AnswerText:      "根据抽屉原理，最坏情况下可先摸出全部西瓜味 12 颗与同形状苹果/桃子糖果，最少需要取出 21 个糖果。",
		}, nil
	}
	if p.httpUpstream == nil {
		return nil, errors.New("http upstream is not configured")
	}

	requestedModel := strings.TrimSpace(model)
	if requestedModel == "" {
		requestedModel = openai.DefaultTestModel
	}
	mappedModel := account.GetMappedModel(requestedModel)

	normalizedEffort := strings.ToLower(strings.TrimSpace(effort))
	if normalizedEffort == "" {
		normalizedEffort = IQDetectionDefaultEffort
	}

	credentialAccount := account
	if account.IsCredentialShadow() {
		resolved, err := resolveCredentialAccount(ctx, p.accountRepo, account)
		if err != nil {
			return nil, fmt.Errorf("resolve credential account: %w", err)
		}
		credentialAccount = resolved
	}

	if credentialAccount.IsOAuth() {
		return p.probeCodexOAuth(ctx, account, credentialAccount, mappedModel, normalizedEffort, prompt, false)
	}
	if credentialAccount.Type == AccountTypeAPIKey {
		return p.probeOpenAIAPIKey(ctx, account, credentialAccount, mappedModel, normalizedEffort, prompt)
	}
	return nil, fmt.Errorf("unsupported account type %q", credentialAccount.Type)
}

func (p *OpenAIIQDetectionProber) probeCodexOAuth(
	ctx context.Context,
	account *Account,
	credentialAccount *Account,
	mappedModel string,
	effort string,
	prompt string,
	retriedTaskRecovery bool,
) (*IQDetectionProbeResult, error) {
	authToken := ""
	if !credentialAccount.IsOpenAIAgentIdentity() {
		authToken = p.resolveOAuthAccessToken(ctx, credentialAccount)
		if authToken == "" {
			return nil, errors.New("no OpenAI OAuth access token available")
		}
	}

	upstreamModel := normalizeOpenAIModelForUpstream(credentialAccount, mappedModel)
	payload := buildCodexOAuthIQProbePayload(upstreamModel, effort, prompt)
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal codex oauth payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, chatgptCodexAPIURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("create codex oauth request: %w", err)
	}
	req = req.WithContext(WithHTTPUpstreamProfile(req.Context(), HTTPUpstreamProfileOpenAI))
	req.Host = "chatgpt.com"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("OpenAI-Beta", "responses=experimental")

	if credentialAccount.IsOpenAIAgentIdentity() {
		authHeaders, authErr := buildAgentIdentityAuthenticationHeaders(
			ctx,
			p.accountRepo,
			p.agentIdentityWS,
			&p.agentIdentityTaskMu,
			credentialAccount,
		)
		if authErr != nil {
			return nil, fmt.Errorf("build agent identity auth: %w", authErr)
		}
		for key, values := range authHeaders {
			for _, value := range values {
				req.Header.Add(key, value)
			}
		}
	} else {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	canonical := resolveCodexOutboundIdentity("")
	req.Header.Set("Originator", canonical.originator)
	if customUA := strings.TrimSpace(credentialAccount.GetOpenAIUserAgent()); customUA != "" {
		req.Header.Set("User-Agent", customUA)
	} else {
		req.Header.Set("User-Agent", canonical.userAgent)
	}
	setOpenAIChatGPTAccountHeaders(req.Header, credentialAccount)
	enforceCodexIdentityHeadersWithUA(req.Header, credentialAccount.GetOpenAIUserAgent())
	credentialAccount.ApplyHeaderOverrides(req.Header)

	proxyURL := resolveAccountProxyURL(account)
	resp, err := p.doUpstream(req, proxyURL, account, true)
	if err != nil {
		return nil, fmt.Errorf("codex oauth upstream failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, iqDetectionMaxErrorBodyBytes))
		body = redactAgentIdentitySensitiveBodyForAccount(ctx, p.accountRepo, credentialAccount, body)
		if !retriedTaskRecovery && credentialAccount.IsOpenAIAgentIdentity() && isAgentIdentityTaskInvalidHTTPResponse(resp.StatusCode, body) {
			expectedTaskID := credentialAccount.GetCredential("task_id")
			if recErr := ensureAgentIdentityTaskForAccount(ctx, p.accountRepo, p.agentIdentityWS, &p.agentIdentityTaskMu, credentialAccount, expectedTaskID); recErr == nil {
				return p.probeCodexOAuth(ctx, account, credentialAccount, mappedModel, effort, prompt, true)
			}
		}
		return nil, formatIQProbeHTTPError("Codex OAuth", resp.StatusCode, body)
	}

	res, err := parseResponsesIQStream(resp.Body, upstreamModel)
	if err != nil {
		return nil, err
	}
	res.Protocol = "codex_oauth"
	return res, nil
}

func (p *OpenAIIQDetectionProber) probeOpenAIAPIKey(
	ctx context.Context,
	account *Account,
	credentialAccount *Account,
	mappedModel string,
	effort string,
	prompt string,
) (*IQDetectionProbeResult, error) {
	authToken := strings.TrimSpace(credentialAccount.GetOpenAIProtocolAPIKey())
	if authToken == "" {
		return nil, errors.New("no OpenAI API key available")
	}

	baseURL := strings.TrimSpace(credentialAccount.GetOpenAIBaseURL())
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}
	normalizedBaseURL, err := p.validateUpstreamBaseURL(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL: %w", err)
	}

	if openai_compat.ShouldUseResponsesAPI(account.Extra) {
		apiURL := buildOpenAIResponsesURLForPlatform(credentialAccount.Platform, normalizedBaseURL)
		payload := buildAPIKeyResponsesIQProbePayload(mappedModel, effort, prompt)
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("marshal responses payload: %w", err)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payloadBytes))
		if err != nil {
			return nil, fmt.Errorf("create responses request: %w", err)
		}
		req = req.WithContext(WithHTTPUpstreamProfile(req.Context(), HTTPUpstreamProfileOpenAI))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "text/event-stream")
		applyOpenAICodexProbeHeaders(req.Header)
		req.Header.Set("Authorization", "Bearer "+authToken)
		credentialAccount.ApplyHeaderOverrides(req.Header)

		resp, err := p.doUpstream(req, resolveAccountProxyURL(account), account, false)
		if err != nil {
			return nil, fmt.Errorf("responses upstream failed: %w", err)
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, iqDetectionMaxErrorBodyBytes))
			return nil, formatIQProbeHTTPError("Responses API", resp.StatusCode, body)
		}

		res, err := parseResponsesIQStream(resp.Body, mappedModel)
		if err != nil {
			return nil, err
		}
		res.Protocol = "responses"
		return res, nil
	}

	apiURL := buildOpenAIChatCompletionsURL(normalizedBaseURL)
	payload := buildChatCompletionsIQProbePayload(mappedModel, effort, prompt)
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal chat completions payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("create chat completions request: %w", err)
	}
	req = req.WithContext(WithHTTPUpstreamProfile(req.Context(), HTTPUpstreamProfileOpenAI))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+authToken)
	applyOpenCodeUpstreamUserAgent(account, apiURL, req.Header)
	credentialAccount.ApplyHeaderOverrides(req.Header)

	resp, err := p.doUpstream(req, resolveAccountProxyURL(account), account, false)
	if err != nil {
		return nil, fmt.Errorf("chat completions upstream failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, iqDetectionMaxErrorBodyBytes))
		return nil, formatIQProbeHTTPError("Chat Completions API", resp.StatusCode, body)
	}

	res, err := parseChatCompletionsIQStream(resp.Body, mappedModel)
	if err != nil {
		return nil, err
	}
	res.Protocol = "chat_completions"
	return res, nil
}

func (p *OpenAIIQDetectionProber) resolveOAuthAccessToken(ctx context.Context, credentialAccount *Account) string {
	// 仅在持有 refresh_token 时走 OpenAITokenProvider（自动刷新即将过期 token），
	// 避免缺失 refresh_token 的账号因诊断探针触发永久下线副作用。
	if p.openaiTokenProvider != nil &&
		!credentialAccount.IsOpenAIPersonalAccessToken() &&
		strings.TrimSpace(credentialAccount.GetOpenAIRefreshToken()) != "" {
		if token, err := p.openaiTokenProvider.GetAccessToken(ctx, credentialAccount); err == nil && strings.TrimSpace(token) != "" {
			return strings.TrimSpace(token)
		}
	}
	return strings.TrimSpace(credentialAccount.GetOpenAIAccessToken())
}

func (p *OpenAIIQDetectionProber) validateUpstreamBaseURL(raw string) (string, error) {
	if p.cfg == nil {
		return urlvalidator.ValidateURLFormat(raw, true)
	}
	if !p.cfg.Security.URLAllowlist.Enabled {
		return urlvalidator.ValidateURLFormat(raw, p.cfg.Security.URLAllowlist.AllowInsecureHTTP)
	}
	return urlvalidator.ValidateHTTPSURL(raw, urlvalidator.ValidationOptions{
		AllowedHosts:     p.cfg.Security.URLAllowlist.UpstreamHosts,
		RequireAllowlist: true,
		AllowPrivate:     p.cfg.Security.URLAllowlist.AllowPrivateHosts,
	})
}

func (p *OpenAIIQDetectionProber) doUpstream(
	req *http.Request,
	proxyURL string,
	account *Account,
	allowPluginOAuth bool,
) (*http.Response, error) {
	if allowPluginOAuth && p.pluginManager != nil {
		resp, handled, err := p.pluginManager.RoundTripOpenAIOAuth(req.Context(), req, proxyURL, account)
		if handled {
			return resp, err
		}
	}
	var tlsProfile *tlsfingerprint.Profile
	if p.tlsFPProfileService != nil {
		tlsProfile = p.tlsFPProfileService.ResolveTLSProfile(account)
	}
	return p.httpUpstream.DoWithTLS(req, proxyURL, account.ID, account.Concurrency, tlsProfile)
}

// buildCodexOAuthIQProbePayload 严格遵守 ChatGPT Codex OAuth /codex/responses 协议约束：
// 必须携带 instructions、store=false、stream=true，严禁携带 temperature/top_p/max_output_tokens。
func buildCodexOAuthIQProbePayload(upstreamModel, effort, prompt string) map[string]any {
	return map[string]any{
		"model":        upstreamModel,
		"instructions": openai.CodexBaseInstructionsForModel(upstreamModel),
		"input": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{
						"type": "input_text",
						"text": prompt,
					},
				},
			},
		},
		"reasoning": map[string]any{
			"effort":  effort,
			"summary": "auto",
		},
		"include": []string{"reasoning.encrypted_content"},
		"store":   false,
		"stream":  true,
	}
}

func buildAPIKeyResponsesIQProbePayload(model, effort, prompt string) map[string]any {
	return map[string]any{
		"model":        model,
		"instructions": openai.DefaultInstructions,
		"input": []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{
						"type": "input_text",
						"text": prompt,
					},
				},
			},
		},
		"reasoning": map[string]any{
			"effort": effort,
		},
		"stream": true,
	}
}

func buildChatCompletionsIQProbePayload(model, effort, prompt string) map[string]any {
	return map[string]any{
		"model": model,
		"messages": []map[string]any{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"reasoning_effort": effort,
		"stream":           true,
		"stream_options": map[string]any{
			"include_usage": true,
		},
	}
}

func formatIQProbeHTTPError(source string, statusCode int, body []byte) error {
	msg := strings.TrimSpace(extractUpstreamErrorMessage(body))
	if msg == "" {
		msg = truncateRunes(string(body), 200)
	}
	if msg == "" {
		return fmt.Errorf("%s HTTP %d", source, statusCode)
	}
	return fmt.Errorf("%s HTTP %d: %s", source, statusCode, msg)
}

// parseResponsesIQStream 解析 OpenAI / Codex Responses SSE 流（兼容单帧 JSON 响应回退）。
func parseResponsesIQStream(body io.Reader, fallbackModel string) (*IQDetectionProbeResult, error) {
	rawBytes, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("read responses stream: %w", err)
	}
	trimmed := bytes.TrimSpace(rawBytes)
	if len(trimmed) == 0 {
		return nil, errors.New("empty response from Responses API")
	}

	// 兼容部分中转站忽略 stream=true 直接返回单包 JSON response 对象。
	if trimmed[0] == '{' {
		return parseUnaryResponsesJSON(trimmed, fallbackModel)
	}

	scanner := bufio.NewScanner(bytes.NewReader(rawBytes))
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)

	var (
		deltas          []string
		fallbackText    string
		responseModel   string
		inputTokens     int
		outputTokens    int
		reasoningTokens int
		seenCompleted   bool
	)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !sseDataPrefix.MatchString(line) {
			continue
		}
		jsonStr := sseDataPrefix.ReplaceAllString(line, "")
		if jsonStr == "[DONE]" {
			break
		}
		if !gjson.Valid(jsonStr) {
			continue
		}

		eventType := gjson.Get(jsonStr, "type").String()
		switch eventType {
		case "response.created", "response.in_progress":
			if m := strings.TrimSpace(gjson.Get(jsonStr, "response.model").String()); m != "" {
				responseModel = m
			}
		case "response.output_text.delta":
			if d := gjson.Get(jsonStr, "delta").String(); d != "" {
				deltas = append(deltas, d)
			}
		case "response.output_text.done":
			if fallbackText == "" {
				fallbackText = gjson.Get(jsonStr, "text").String()
			}
		case "response.completed", "response.done":
			seenCompleted = true
			if m := strings.TrimSpace(gjson.Get(jsonStr, "response.model").String()); m != "" {
				responseModel = m
			}
			inTok, outTok, reasonTok := extractResponsesUsageFromGJSON(gjson.Get(jsonStr, "response.usage"))
			if inTok > 0 {
				inputTokens = inTok
			}
			if outTok > 0 {
				outputTokens = outTok
			}
			if reasonTok > 0 {
				reasoningTokens = reasonTok
			}
			if fallbackText == "" {
				fallbackText = extractResponsesOutputText(gjson.Get(jsonStr, "response.output"))
			}
		case "response.failed":
			errMsg := strings.TrimSpace(gjson.Get(jsonStr, "response.error.message").String())
			if errMsg == "" {
				errMsg = "OpenAI Responses failed"
			}
			return nil, errors.New(errMsg)
		case "error":
			errMsg := strings.TrimSpace(gjson.Get(jsonStr, "error.message").String())
			if errMsg == "" {
				errMsg = strings.TrimSpace(gjson.Get(jsonStr, "message").String())
			}
			if errMsg == "" {
				errMsg = "OpenAI Responses stream error"
			}
			return nil, errors.New(errMsg)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan responses stream: %w", err)
	}

	answer := strings.Join(deltas, "")
	if strings.TrimSpace(answer) == "" {
		answer = fallbackText
	}
	if !seenCompleted && strings.TrimSpace(answer) == "" {
		return nil, errors.New("responses stream ended before completion")
	}
	if responseModel == "" {
		responseModel = fallbackModel
	}

	return &IQDetectionProbeResult{
		InputTokens:     inputTokens,
		OutputTokens:    outputTokens,
		ReasoningTokens: reasoningTokens,
		ResponseModel:   responseModel,
		AnswerText:      answer,
	}, nil
}

func parseUnaryResponsesJSON(raw []byte, fallbackModel string) (*IQDetectionProbeResult, error) {
	if errMsg := strings.TrimSpace(gjson.GetBytes(raw, "error.message").String()); errMsg != "" {
		return nil, errors.New(errMsg)
	}
	root := gjson.ParseBytes(raw)
	if respObj := root.Get("response"); respObj.Exists() && respObj.IsObject() {
		root = respObj
	}
	responseModel := strings.TrimSpace(root.Get("model").String())
	if responseModel == "" {
		responseModel = fallbackModel
	}
	inTok, outTok, reasonTok := extractResponsesUsageFromGJSON(root.Get("usage"))
	answer := extractResponsesOutputText(root.Get("output"))
	if strings.TrimSpace(answer) == "" {
		answer = root.Get("output_text").String()
	}
	return &IQDetectionProbeResult{
		InputTokens:     inTok,
		OutputTokens:    outTok,
		ReasoningTokens: reasonTok,
		ResponseModel:   responseModel,
		AnswerText:      answer,
	}, nil
}

func extractResponsesUsageFromGJSON(usage gjson.Result) (inputTokens, outputTokens, reasoningTokens int) {
	if !usage.Exists() {
		return 0, 0, 0
	}
	inputTokens = int(usage.Get("input_tokens").Int())
	outputTokens = int(usage.Get("output_tokens").Int())
	reasoningTokens = int(usage.Get("output_tokens_details.reasoning_tokens").Int())
	if reasoningTokens == 0 {
		reasoningTokens = int(usage.Get("reasoning_tokens").Int())
	}
	return inputTokens, outputTokens, reasoningTokens
}

func extractResponsesOutputText(output gjson.Result) string {
	if !output.Exists() || !output.IsArray() {
		return ""
	}
	var parts []string
	for _, item := range output.Array() {
		content := item.Get("content")
		if !content.Exists() || !content.IsArray() {
			continue
		}
		for _, c := range content.Array() {
			cType := c.Get("type").String()
			if cType == "output_text" || cType == "text" || cType == "" {
				if txt := c.Get("text").String(); txt != "" {
					parts = append(parts, txt)
				}
			}
		}
	}
	return strings.Join(parts, "")
}

// parseChatCompletionsIQStream 解析 /v1/chat/completions SSE 流（兼容单包 JSON 响应回退）。
func parseChatCompletionsIQStream(body io.Reader, fallbackModel string) (*IQDetectionProbeResult, error) {
	rawBytes, err := io.ReadAll(body)
	if err != nil {
		return nil, fmt.Errorf("read chat completions stream: %w", err)
	}
	trimmed := bytes.TrimSpace(rawBytes)
	if len(trimmed) == 0 {
		return nil, errors.New("empty response from Chat Completions API")
	}

	if trimmed[0] == '{' {
		return parseUnaryChatCompletionsJSON(trimmed, fallbackModel)
	}

	scanner := bufio.NewScanner(bytes.NewReader(rawBytes))
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)

	var (
		deltas          []string
		responseModel   string
		inputTokens     int
		outputTokens    int
		reasoningTokens int
		seenChunk       bool
	)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !sseDataPrefix.MatchString(line) {
			continue
		}
		jsonStr := sseDataPrefix.ReplaceAllString(line, "")
		if jsonStr == "[DONE]" {
			break
		}
		if !gjson.Valid(jsonStr) {
			continue
		}
		seenChunk = true

		if errMsg := strings.TrimSpace(gjson.Get(jsonStr, "error.message").String()); errMsg != "" {
			return nil, errors.New(errMsg)
		}
		if m := strings.TrimSpace(gjson.Get(jsonStr, "model").String()); m != "" {
			responseModel = m
		}

		choices := gjson.Get(jsonStr, "choices")
		if choices.IsArray() {
			for _, ch := range choices.Array() {
				if d := ch.Get("delta.content").String(); d != "" {
					deltas = append(deltas, d)
				} else if msg := ch.Get("message.content").String(); msg != "" {
					deltas = append(deltas, msg)
				}
			}
		}

		usage := gjson.Get(jsonStr, "usage")
		if usage.Exists() && usage.IsObject() {
			inTok, outTok, reasonTok := extractChatCompletionsUsageFromGJSON(usage)
			if inTok > 0 {
				inputTokens = inTok
			}
			if outTok > 0 {
				outputTokens = outTok
			}
			if reasonTok > 0 {
				reasoningTokens = reasonTok
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan chat completions stream: %w", err)
	}
	if !seenChunk {
		return nil, errors.New("invalid Chat Completions stream: no JSON chunks received")
	}
	if responseModel == "" {
		responseModel = fallbackModel
	}

	return &IQDetectionProbeResult{
		InputTokens:     inputTokens,
		OutputTokens:    outputTokens,
		ReasoningTokens: reasoningTokens,
		ResponseModel:   responseModel,
		AnswerText:      strings.Join(deltas, ""),
	}, nil
}

func parseUnaryChatCompletionsJSON(raw []byte, fallbackModel string) (*IQDetectionProbeResult, error) {
	if errMsg := strings.TrimSpace(gjson.GetBytes(raw, "error.message").String()); errMsg != "" {
		return nil, errors.New(errMsg)
	}
	responseModel := strings.TrimSpace(gjson.GetBytes(raw, "model").String())
	if responseModel == "" {
		responseModel = fallbackModel
	}
	inTok, outTok, reasonTok := extractChatCompletionsUsageFromGJSON(gjson.GetBytes(raw, "usage"))
	answer := gjson.GetBytes(raw, "choices.0.message.content").String()
	return &IQDetectionProbeResult{
		InputTokens:     inTok,
		OutputTokens:    outTok,
		ReasoningTokens: reasonTok,
		ResponseModel:   responseModel,
		AnswerText:      answer,
	}, nil
}

func extractChatCompletionsUsageFromGJSON(usage gjson.Result) (inputTokens, outputTokens, reasoningTokens int) {
	if !usage.Exists() {
		return 0, 0, 0
	}
	inputTokens = int(usage.Get("prompt_tokens").Int())
	if inputTokens == 0 {
		inputTokens = int(usage.Get("input_tokens").Int())
	}
	outputTokens = int(usage.Get("completion_tokens").Int())
	if outputTokens == 0 {
		outputTokens = int(usage.Get("output_tokens").Int())
	}
	reasoningTokens = int(usage.Get("completion_tokens_details.reasoning_tokens").Int())
	if reasoningTokens == 0 {
		reasoningTokens = int(usage.Get("output_tokens_details.reasoning_tokens").Int())
	}
	if reasoningTokens == 0 {
		reasoningTokens = int(usage.Get("reasoning_tokens").Int())
	}
	return inputTokens, outputTokens, reasoningTokens
}
