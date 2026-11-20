package service

import (
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	IQBenchmarkCandyLogic = "candy_logic"
	IQBenchmarkPelicanSVG = "pelican_svg"

	IQDetectionPelicanTestsPerGroup = 1
	IQPelicanPassScore              = 70
	IQPelicanWarningScore           = 45
	IQDetectionMaxArtifactBytes     = 128 * 1024
)

// IQDetectionPelicanPrompt 经典“鹈鹕骑自行车 SVG 2D 动画”离线空间构图与编码评测题。
const IQDetectionPelicanPrompt = `创建一个html，内容是SVG绘制一个鹈鹕骑自行车的2D动画，不要联网，不要参考其他文件。`

const syntheticPelicanSVGArtifactHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Pelican Riding a Bicycle</title>
<style>
  body { margin: 0; background: #eef6ff; display: flex; align-items: center; justify-content: center; height: 100vh; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes flap { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-10deg); } }
  .wheel { animation: spin 1.6s linear infinite; transform-box: fill-box; transform-origin: center; }
  .pelican-body { animation: bob 0.8s ease-in-out infinite; }
  .wing { animation: flap 0.8s ease-in-out infinite; transform-box: fill-box; transform-origin: left center; }
</style>
</head>
<body>
<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#dbeafe"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#sky)"/>
  <line x1="40" y1="336" x2="600" y2="336" stroke="#94a3b8" stroke-width="4"/>
  <g id="rear-wheel" class="wheel">
    <circle cx="190" cy="280" r="52" fill="none" stroke="#1e293b" stroke-width="8"/>
    <circle cx="190" cy="280" r="44" fill="none" stroke="#64748b" stroke-width="2"/>
    <line x1="138" y1="280" x2="242" y2="280" stroke="#64748b" stroke-width="2"/>
    <line x1="190" y1="228" x2="190" y2="332" stroke="#64748b" stroke-width="2"/>
    <line x1="153" y1="243" x2="227" y2="317" stroke="#64748b" stroke-width="2"/>
    <line x1="227" y1="243" x2="153" y2="317" stroke="#64748b" stroke-width="2"/>
    <circle cx="190" cy="280" r="8" fill="#0f172a"/>
  </g>
  <g id="front-wheel" class="wheel">
    <circle cx="430" cy="280" r="52" fill="none" stroke="#1e293b" stroke-width="8"/>
    <circle cx="430" cy="280" r="44" fill="none" stroke="#64748b" stroke-width="2"/>
    <line x1="378" y1="280" x2="482" y2="280" stroke="#64748b" stroke-width="2"/>
    <line x1="430" y1="228" x2="430" y2="332" stroke="#64748b" stroke-width="2"/>
    <line x1="393" y1="243" x2="467" y2="317" stroke="#64748b" stroke-width="2"/>
    <line x1="467" y1="243" x2="393" y2="317" stroke="#64748b" stroke-width="2"/>
    <circle cx="430" cy="280" r="8" fill="#0f172a"/>
  </g>
  <g id="bicycle-frame">
    <polygon points="190,280 285,280 355,205 250,205" fill="none" stroke="#0d9488" stroke-width="6"/>
    <line x1="250" y1="205" x2="285" y2="280" stroke="#0d9488" stroke-width="6"/>
    <line x1="355" y1="205" x2="430" y2="280" stroke="#0d9488" stroke-width="6"/>
    <path d="M355 205 C360 175 375 168 398 170" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round"/>
    <rect id="saddle" x="226" y="192" width="44" height="10" rx="5" fill="#1e293b"/>
    <circle id="crank-sprocket" cx="285" cy="280" r="14" fill="#f59e0b" stroke="#b45309" stroke-width="3"/>
    <line id="pedal" x1="285" y1="280" x2="305" y2="304" stroke="#334155" stroke-width="4"/>
    <rect x="296" y="302" width="18" height="6" rx="2" fill="#0f172a"/>
  </g>
  <g id="pelican" class="pelican-body">
    <path d="M235 190 C205 165 215 118 265 122 C310 126 322 168 292 194 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
    <path id="wing" class="wing" d="M242 146 C265 138 292 150 284 176 C264 182 244 172 242 146 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
    <path d="M282 130 C295 96 312 72 332 76 C348 80 344 106 322 134" fill="none" stroke="#f8fafc" stroke-width="22" stroke-linecap="round"/>
    <circle cx="332" cy="76" r="18" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <circle cx="338" cy="72" r="3.5" fill="#0f172a"/>
    <path id="beak" d="M348 72 C386 68 424 74 446 84 C418 88 380 88 348 84 Z" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
    <path id="throat-pouch" d="M348 84 C378 118 418 116 442 84 C412 90 378 90 348 84 Z" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
    <path d="M262 192 C272 224 282 250 302 302" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/>
    <path d="M298 156 C332 162 362 166 392 170" fill="none" stroke="#f8fafc" stroke-width="8" stroke-linecap="round"/>
  </g>
</svg>
</body>
</html>`

// IQDetectionPelicanEval 鹈鹕骑自行车 SVG 2D 动画的结构化静态诊断与打分结果（方案 A）。
type IQDetectionPelicanEval struct {
	Score                 int      `json:"score"`
	HasCompleteHTML       bool     `json:"has_complete_html"`
	HasSVG                bool     `json:"has_svg"`
	HasViewBox            bool     `json:"has_view_box"`
	OfflineCompliant      bool     `json:"offline_compliant"`
	PrimitiveCount        int      `json:"primitive_count"`
	PathCount             int      `json:"path_count"`
	CurveCommandCount     int      `json:"curve_command_count"`
	GroupCount            int      `json:"group_count"`
	UniqueColorCount      int      `json:"unique_color_count"`
	HasAnimation          bool     `json:"has_animation"`
	AnimationDriverCount  int      `json:"animation_driver_count"`
	WheelPairDetected     bool     `json:"wheel_pair_detected"`
	SemanticPartsDetected []string `json:"semantic_parts_detected"`
	Issues                []string `json:"issues,omitempty"`
}

var (
	reCodeFenceBlock     = regexp.MustCompile("(?is)```([a-z0-9_-]*)\\s*\\n([\\s\\S]*?)```")
	reSVGBlock           = regexp.MustCompile(`(?is)<svg\b[\s\S]*?</svg>`)
	reHTMLDocBlock       = regexp.MustCompile(`(?is)(?:<!doctype\s+html[^>]*>\s*)?<html\b[\s\S]*?</html>`)
	reHTMLOpenTag        = regexp.MustCompile(`(?i)<(?:!doctype\s+html|html\b|body\b)`)
	reHTMLCloseTag       = regexp.MustCompile(`(?i)</(?:html|body)>`)
	reExternalURLRef     = regexp.MustCompile(`(?i)(?:(?:src|href|xlink:href)\s*=\s*["']\s*(?:https?:)?//|url\(\s*["']?\s*(?:https?:)?//|\b(?:fetch|xmlhttprequest)\s*\(\s*["']\s*https?://|@import\s+(?:url\()?["']\s*(?:https?:)?//)`)
	reXMLNSWhitelisted   = regexp.MustCompile(`(?i)xmlns(?::[a-z0-9_-]+)?\s*=\s*["']https?://www\.w3\.org/[^"']*["']`)
	reCSSKeyframes       = regexp.MustCompile(`(?i)@(?:-webkit-)?keyframes\s+[a-z0-9_-]+`)
	reCSSAnimationProp   = regexp.MustCompile(`(?i)\banimation(?:-name)?\s*:\s*[^;{}]+`)
	reJSAnimationLoop    = regexp.MustCompile(`\b(?:requestAnimationFrame|setInterval)\s*\(`)
	reColorLiteral       = regexp.MustCompile(`(?i)(?:#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\))`)
	reNamedFillStroke    = regexp.MustCompile(`(?i)\b(?:fill|stroke)\s*[:=]\s*["']?([a-z]{3,20})["']?`)
	reGradientTag        = regexp.MustCompile(`(?i)<(?:linear|radial)Gradient\b`)
	rePathCurveCommands  = regexp.MustCompile(`[CcSsQqTtAa]`)
	reNumberToken        = regexp.MustCompile(`-?\d+(?:\.\d+)?`)
	reTranslateTransform = regexp.MustCompile(`(?i)translate\(\s*(-?\d+(?:\.\d+)?)(?:[\s,]+(-?\d+(?:\.\d+)?))?\s*\)`)
	reWheelKeyword       = regexp.MustCompile(`(?i)(?:wheel|tire|tyre|rim|spoke|车轮|前轮|后轮|轮胎|轮毂)`)
)

type pelicanCircle struct {
	cx float64
	cy float64
	r  float64
}

// IsValidIQBenchmarkType 判断评测题型是否受支持。
func IsValidIQBenchmarkType(benchmarkType string) bool {
	switch benchmarkType {
	case IQBenchmarkCandyLogic, IQBenchmarkPelicanSVG:
		return true
	default:
		return false
	}
}

// NormalizeIQBenchmarkType 将空字符串回退为默认题型。
func NormalizeIQBenchmarkType(raw string) string {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return IQBenchmarkCandyLogic
	}
	return trimmed
}

// NormalizeAndValidateIQBenchmarkTypes 归一化并校验启用的题型列表（支持单选或双题型同时开启，按固定规范顺序去重）。
func NormalizeAndValidateIQBenchmarkTypes(rawTypes []string, legacySingle string) ([]string, error) {
	if len(rawTypes) > 0 {
		selected := make(map[string]struct{}, len(rawTypes))
		for _, item := range rawTypes {
			norm := strings.ToLower(strings.TrimSpace(item))
			if norm == "" {
				continue
			}
			if !IsValidIQBenchmarkType(norm) {
				return nil, fmt.Errorf("%w: benchmark_types contains unsupported value %q", ErrIQDetectionInvalidConfig, item)
			}
			selected[norm] = struct{}{}
		}
		if len(selected) == 0 {
			return nil, fmt.Errorf("%w: at least one benchmark must be enabled", ErrIQDetectionInvalidConfig)
		}
		ordered := make([]string, 0, 2)
		for _, canonical := range []string{IQBenchmarkCandyLogic, IQBenchmarkPelicanSVG} {
			if _, ok := selected[canonical]; ok {
				ordered = append(ordered, canonical)
			}
		}
		return ordered, nil
	}

	single := NormalizeIQBenchmarkType(legacySingle)
	if !IsValidIQBenchmarkType(single) {
		return nil, fmt.Errorf("%w: benchmark_type must be one of candy_logic, pelican_svg", ErrIQDetectionInvalidConfig)
	}
	return []string{single}, nil
}

// EffectiveIQBenchmarkTypes 返回配置中实际生效的题型列表（兜底至少包含一项合法题型）。
func EffectiveIQBenchmarkTypes(cfg *IQDetectionConfig) []string {
	if cfg == nil {
		return []string{IQBenchmarkCandyLogic}
	}
	types, err := NormalizeAndValidateIQBenchmarkTypes(cfg.BenchmarkTypes, cfg.BenchmarkType)
	if err != nil || len(types) == 0 {
		return []string{IQBenchmarkCandyLogic}
	}
	return types
}

// EffectiveTestsPerGroupForBenchmark 计算指定题型的实际抽检轮数：鹈鹕 SVG 动画恒定固定为 1 轮/组，抽检轮数仅对黑袋摸糖题生效。
func EffectiveTestsPerGroupForBenchmark(benchmarkType string, configured int) int {
	if NormalizeIQBenchmarkType(benchmarkType) == IQBenchmarkPelicanSVG {
		return IQDetectionPelicanTestsPerGroup
	}
	if configured < 1 {
		return IQDetectionDefaultTestsPerGroup
	}
	if configured > IQDetectionMaxTestsPerGroup {
		return IQDetectionMaxTestsPerGroup
	}
	return configured
}

// IQDetectionPromptForBenchmark 返回对应题型的标准内置提示词。
func IQDetectionPromptForBenchmark(benchmarkType string) string {
	if NormalizeIQBenchmarkType(benchmarkType) == IQBenchmarkPelicanSVG {
		return IQDetectionPelicanPrompt
	}
	return IQDetectionCandyPrompt
}

// BuiltinIQDetectionPrompts 返回全部内置题型及其提示词映射。
func BuiltinIQDetectionPrompts() map[string]string {
	return map[string]string{
		IQBenchmarkCandyLogic: IQDetectionCandyPrompt,
		IQBenchmarkPelicanSVG: IQDetectionPelicanPrompt,
	}
}

// ExtractPelicanHTMLArtifact 从模型回复中提取可独立渲染的 HTML/SVG 工件（超过上限则截断保护）。
// 返回：(提取到的纯净 HTML 文档, 是否包含完整闭合 HTML 外壳)。
func ExtractPelicanHTMLArtifact(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false
	}

	candidate := ""
	matches := reCodeFenceBlock.FindAllStringSubmatch(trimmed, -1)
	for _, m := range matches {
		if len(m) < 3 {
			continue
		}
		lang := strings.ToLower(strings.TrimSpace(m[1]))
		body := strings.TrimSpace(m[2])
		if body == "" {
			continue
		}
		looksRelevant := lang == "html" || lang == "htm" || lang == "svg" ||
			strings.Contains(strings.ToLower(body), "<svg") ||
			strings.Contains(strings.ToLower(body), "<html")
		if looksRelevant && len(body) > len(candidate) {
			candidate = body
		}
	}

	if candidate == "" {
		if htmlDoc := reHTMLDocBlock.FindString(trimmed); htmlDoc != "" {
			candidate = strings.TrimSpace(htmlDoc)
		} else if svgDoc := reSVGBlock.FindString(trimmed); svgDoc != "" {
			candidate = strings.TrimSpace(svgDoc)
		} else if idx := strings.Index(strings.ToLower(trimmed), "<!doctype html"); idx >= 0 {
			candidate = strings.TrimSpace(trimmed[idx:])
		} else if idx := strings.Index(strings.ToLower(trimmed), "<html"); idx >= 0 {
			candidate = strings.TrimSpace(trimmed[idx:])
		} else if idx := strings.Index(strings.ToLower(trimmed), "<svg"); idx >= 0 {
			candidate = strings.TrimSpace(trimmed[idx:])
		}
	}

	if candidate == "" {
		return "", false
	}

	hasCompleteHTML := reHTMLOpenTag.MatchString(candidate) && reHTMLCloseTag.MatchString(candidate)
	if len(candidate) > IQDetectionMaxArtifactBytes {
		// 超过上限时保留前 IQDetectionMaxArtifactBytes 字节（避免数据库 JSONB 膨胀）
		candidate = truncateUTF8Bytes(candidate, IQDetectionMaxArtifactBytes)
		hasCompleteHTML = reHTMLOpenTag.MatchString(candidate) && reHTMLCloseTag.MatchString(candidate)
	}

	// 若模型仅输出了裸 <svg>...</svg>，为前端沙箱预览自动包装最小离线 HTML 外壳
	if !reHTMLOpenTag.MatchString(candidate) && reSVGBlock.MatchString(candidate) {
		wrapped := "<!DOCTYPE html>\n<html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"><style>html,body{margin:0;padding:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f8fafc;overflow:hidden}svg{max-width:100%;max-height:100%}</style></head><body>" + candidate + "</body></html>"
		return truncateUTF8Bytes(wrapped, IQDetectionMaxArtifactBytes), false
	}

	return candidate, hasCompleteHTML
}

func truncateUTF8Bytes(s string, maxBytes int) string {
	if len(s) <= maxBytes || maxBytes <= 0 {
		return s
	}
	b := []byte(s[:maxBytes])
	for len(b) > 0 && (b[len(b)-1]&0xC0) == 0x80 {
		b = b[:len(b)-1]
	}
	if len(b) > 0 && b[len(b)-1] >= 0xC0 {
		b = b[:len(b)-1]
	}
	return string(b)
}

// EvaluatePelicanSVG 对模型生成的“鹈鹕骑自行车 SVG 2D 动画”HTML 进行静态结构、动画与主题诊断评分（0..100）。
func EvaluatePelicanSVG(rawAnswer string) (IQDetectionPelicanEval, string) {
	artifact, hasCompleteHTML := ExtractPelicanHTMLArtifact(rawAnswer)
	eval := IQDetectionPelicanEval{
		HasCompleteHTML:       hasCompleteHTML,
		OfflineCompliant:      true,
		SemanticPartsDetected: []string{},
		Issues:                []string{},
	}

	if strings.TrimSpace(artifact) == "" {
		eval.Issues = append(eval.Issues, "missing_html_svg")
		return eval, ""
	}

	// 1. 检查是否违反“不要联网”要求（排除标准 W3C xmlns 声明）
	sanitizedForURLCheck := reXMLNSWhitelisted.ReplaceAllString(artifact, "")
	if reExternalURLRef.MatchString(sanitizedForURLCheck) {
		eval.OfflineCompliant = false
		eval.Issues = append(eval.Issues, "external_network_resource")
	}

	// 2. 提取并解析所有闭合 <svg>...</svg> 块
	svgBlocks := reSVGBlock.FindAllString(artifact, -1)
	if len(svgBlocks) == 0 {
		eval.Issues = append(eval.Issues, "missing_svg_element")
		if eval.HasCompleteHTML {
			eval.Score = 10
		}
		return eval, artifact
	}
	eval.HasSVG = true

	var (
		circles            []pelicanCircle
		smilAnimCount      int
		wheelSemanticHits  int
		hasGradient        = reGradientTag.MatchString(artifact)
		colorSet           = make(map[string]struct{})
		hasPositiveViewBox bool
	)

	for _, svgBlock := range svgBlocks {
		dec := xml.NewDecoder(strings.NewReader(svgBlock))
		dec.Strict = false
		dec.AutoClose = xml.HTMLAutoClose
		dec.Entity = xml.HTMLEntity

		type offsetPoint struct{ x, y float64 }
		offsetStack := []offsetPoint{{0, 0}}

		for {
			tok, err := dec.Token()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			switch t := tok.(type) {
			case xml.EndElement:
				if len(offsetStack) > 1 {
					offsetStack = offsetStack[:len(offsetStack)-1]
				}
				continue
			case xml.StartElement:
				tag := strings.ToLower(t.Name.Local)
				attrs := make(map[string]string, len(t.Attr))
				for _, a := range t.Attr {
					attrs[strings.ToLower(a.Name.Local)] = strings.TrimSpace(a.Value)
				}

				cur := offsetStack[len(offsetStack)-1]
				tx, ty := parseTranslateOffset(attrs["transform"])
				nextOffset := offsetPoint{x: cur.x + tx, y: cur.y + ty}
				offsetStack = append(offsetStack, nextOffset)

				switch tag {
				case "svg":
					if parsePositiveViewBox(attrs["viewbox"]) ||
						(parsePositiveDimension(attrs["width"]) && parsePositiveDimension(attrs["height"])) {
						hasPositiveViewBox = true
					}
				case "g":
					eval.GroupCount++
					if reWheelKeyword.MatchString(attrs["id"] + " " + attrs["class"]) {
						wheelSemanticHits++
					}
				case "path":
					eval.PrimitiveCount++
					eval.PathCount++
					if d := attrs["d"]; d != "" {
						eval.CurveCommandCount += len(rePathCurveCommands.FindAllString(d, -1))
					}
				case "circle":
					eval.PrimitiveCount++
					r := parseFloatAttr(attrs["r"])
					if r > 0 {
						circles = append(circles, pelicanCircle{
							cx: parseFloatAttr(attrs["cx"]) + nextOffset.x,
							cy: parseFloatAttr(attrs["cy"]) + nextOffset.y,
							r:  r,
						})
					}
					if reWheelKeyword.MatchString(attrs["id"] + " " + attrs["class"]) {
						wheelSemanticHits++
					}
				case "ellipse", "rect", "polygon", "polyline", "line":
					eval.PrimitiveCount++
				case "animate", "animatetransform", "animatemotion", "set":
					smilAnimCount++
				}
			}
		}
	}

	eval.HasViewBox = hasPositiveViewBox
	if !eval.HasViewBox {
		eval.Issues = append(eval.Issues, "missing_viewbox")
	}

	// 3. 统计色彩与渐变丰富度
	for _, c := range reColorLiteral.FindAllString(artifact, -1) {
		colorSet[strings.ToLower(c)] = struct{}{}
	}
	for _, m := range reNamedFillStroke.FindAllStringSubmatch(artifact, -1) {
		if len(m) >= 2 {
			val := strings.ToLower(m[1])
			if val != "none" && val != "transparent" && val != "currentcolor" && val != "inherit" && val != "url" {
				colorSet[val] = struct{}{}
			}
		}
	}
	eval.UniqueColorCount = len(colorSet)

	// 4. 2D 动画真实性与驱动数量统计
	keyframesCount := len(reCSSKeyframes.FindAllString(artifact, -1))
	hasCSSAnimProp := reCSSAnimationProp.MatchString(artifact)
	jsAnimCount := len(reJSAnimationLoop.FindAllString(artifact, -1))

	cssActiveDrivers := 0
	if keyframesCount > 0 && hasCSSAnimProp {
		cssActiveDrivers = keyframesCount
	}
	eval.AnimationDriverCount = cssActiveDrivers + smilAnimCount + jsAnimCount
	eval.HasAnimation = eval.AnimationDriverCount > 0
	if !eval.HasAnimation {
		eval.Issues = append(eval.Issues, "missing_animation")
	}

	// 5. 空间拓扑：双车轮检测（几何同高双圆 OR 语义轮组 >= 2 且含圆形/椭圆元素）
	eval.WheelPairDetected = detectBicycleWheelPair(circles) || (wheelSemanticHits >= 2 && len(circles) >= 2)
	if !eval.WheelPairDetected {
		eval.Issues = append(eval.Issues, "wheel_pair_not_detected")
	}

	// 6. 主题语义部件检测（兼容中英文 ID/class/注释/标题）
	eval.SemanticPartsDetected = detectPelicanSemanticParts(artifact)

	// 7. 综合打分（满分 100）
	score := 0

	// 维度 1：完整性与离线合规（25 分）
	score += 10 // HasSVG 已满足
	if eval.HasViewBox {
		score += 5
	}
	if eval.HasCompleteHTML {
		score += 5
	} else {
		eval.Issues = append(eval.Issues, "incomplete_html_wrapper")
	}
	if eval.OfflineCompliant {
		score += 5
	}

	// 维度 2：SVG 几何构图与视觉丰富度（35 分）
	switch {
	case eval.PrimitiveCount >= 35:
		score += 15
	case eval.PrimitiveCount >= 20:
		score += 11
	case eval.PrimitiveCount >= 12:
		score += 7
	case eval.PrimitiveCount >= 6:
		score += 3
	default:
		eval.Issues = append(eval.Issues, "low_svg_complexity")
	}

	switch {
	case eval.CurveCommandCount >= 15:
		score += 10
	case eval.CurveCommandCount >= 6:
		score += 7
	case eval.CurveCommandCount >= 2:
		score += 4
	default:
		eval.Issues = append(eval.Issues, "lacks_bezier_curves")
	}

	switch {
	case eval.GroupCount >= 5:
		score += 5
	case eval.GroupCount >= 2:
		score += 3
	}

	switch {
	case eval.UniqueColorCount >= 6 || (eval.UniqueColorCount >= 4 && hasGradient):
		score += 5
	case eval.UniqueColorCount >= 3:
		score += 3
	}

	// 维度 3：2D 动画真实性与丰富度（25 分）
	if eval.HasAnimation {
		score += 12
		switch {
		case eval.AnimationDriverCount >= 3:
			score += 13
		case eval.AnimationDriverCount == 2:
			score += 9
		default:
			score += 4
		}
	}

	// 维度 4：主题与空间拓扑自检（15 分）
	if eval.WheelPairDetected {
		score += 8
	}
	switch {
	case len(eval.SemanticPartsDetected) >= 4:
		score += 7
	case len(eval.SemanticPartsDetected) >= 2:
		score += 4
	case len(eval.SemanticPartsDetected) >= 1:
		score += 2
	}

	// 硬护栏：无动画时最高不超过 55 分（不能判为智商正常）
	if !eval.HasAnimation && score > 55 {
		score = 55
	}
	// 硬护栏：图元极少（< 6）时最高不超过 40 分
	if eval.PrimitiveCount < 6 && score > 40 {
		score = 40
	}
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	eval.Score = score

	return eval, artifact
}

// EvaluatePelicanVerdict 根据鹈鹕 SVG 动画抽检批次的均分与通过率判定分组结论。
func EvaluatePelicanVerdict(gradedCount, passCount int, avgScore float64) string {
	if gradedCount <= 0 {
		return IQVerdictError
	}
	if avgScore >= float64(IQPelicanPassScore) && passCount == gradedCount {
		return IQVerdictNormal
	}
	if avgScore < float64(IQPelicanWarningScore) || (passCount == 0 && avgScore < 55) {
		return IQVerdictDegraded
	}
	return IQVerdictWarning
}

func parsePositiveViewBox(raw string) bool {
	if raw == "" {
		return false
	}
	nums := reNumberToken.FindAllString(raw, -1)
	if len(nums) < 4 {
		return false
	}
	w, errW := strconv.ParseFloat(nums[2], 64)
	h, errH := strconv.ParseFloat(nums[3], 64)
	return errW == nil && errH == nil && w > 0 && h > 0
}

func parsePositiveDimension(raw string) bool {
	if raw == "" {
		return false
	}
	m := reNumberToken.FindString(raw)
	if m == "" {
		return false
	}
	v, err := strconv.ParseFloat(m, 64)
	return err == nil && v > 0
}

func parseFloatAttr(raw string) float64 {
	if raw == "" {
		return 0
	}
	m := reNumberToken.FindString(raw)
	if m == "" {
		return 0
	}
	v, err := strconv.ParseFloat(m, 64)
	if err != nil {
		return 0
	}
	return v
}

func parseTranslateOffset(transform string) (float64, float64) {
	if transform == "" {
		return 0, 0
	}
	m := reTranslateTransform.FindStringSubmatch(transform)
	if len(m) < 2 {
		return 0, 0
	}
	tx, _ := strconv.ParseFloat(m[1], 64)
	var ty float64
	if len(m) >= 3 && m[2] != "" {
		ty, _ = strconv.ParseFloat(m[2], 64)
	}
	return tx, ty
}

func detectBicycleWheelPair(circles []pelicanCircle) bool {
	if len(circles) < 2 {
		return false
	}
	for i := 0; i < len(circles); i++ {
		if circles[i].r < 10 {
			continue
		}
		for j := i + 1; j < len(circles); j++ {
			if circles[j].r < 10 {
				continue
			}
			minR := math.Min(circles[i].r, circles[j].r)
			maxR := math.Max(circles[i].r, circles[j].r)
			if maxR <= 0 || minR/maxR < 0.75 {
				continue
			}
			dy := math.Abs(circles[i].cy - circles[j].cy)
			dx := math.Abs(circles[i].cx - circles[j].cx)
			if dy <= maxR*0.5 && dx >= maxR*1.2 {
				return true
			}
		}
	}
	return false
}

func detectPelicanSemanticParts(doc string) []string {
	lower := strings.ToLower(doc)
	checks := []struct {
		name     string
		keywords []string
	}{
		{name: "pelican", keywords: []string{"pelican", "bird", "鹈鹕"}},
		{name: "beak_pouch", keywords: []string{"beak", "bill", "pouch", "throat", "喙", "嘴", "喉囊"}},
		{name: "wing_body", keywords: []string{"wing", "feather", "tail", "neck", "翅膀", "羽毛", "身体"}},
		{name: "bike_frame", keywords: []string{"bicycle", "bike", "frame", "handlebar", "saddle", "fork", "自行车", "车架", "车把", "车座"}},
		{name: "pedal_crank", keywords: []string{"pedal", "crank", "chain", "sprocket", "踏板", "脚踏", "曲柄", "链条"}},
	}

	found := make([]string, 0, len(checks))
	for _, c := range checks {
		for _, kw := range c.keywords {
			if strings.Contains(lower, kw) {
				found = append(found, c.name)
				break
			}
		}
	}
	sort.Strings(found)
	return found
}
