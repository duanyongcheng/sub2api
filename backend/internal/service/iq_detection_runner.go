package service

import (
	"context"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
)

const (
	iqDetectionRunnerTickInterval  = 1 * time.Minute
	iqDetectionRunnerPatrolTimeout = 15 * time.Minute
)

// IQDetectionRunner 后台周期扫描 iq_detection_config，当 enabled=true 且距离上次巡检已满 interval_minutes 时自动触发抽检。
type IQDetectionRunner struct {
	svc *IQDetectionService

	startOnce sync.Once
	stopOnce  sync.Once
	cancel    context.CancelFunc
	done      chan struct{}
}

// NewIQDetectionRunner 创建 IQDetectionRunner。
func NewIQDetectionRunner(svc *IQDetectionService) *IQDetectionRunner {
	return &IQDetectionRunner{
		svc:  svc,
		done: make(chan struct{}),
	}
}

// Start 启动每分钟轮询协程。
func (r *IQDetectionRunner) Start() {
	if r == nil || r.svc == nil {
		return
	}
	r.startOnce.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		r.cancel = cancel

		go func() {
			defer close(r.done)
			ticker := time.NewTicker(iqDetectionRunnerTickInterval)
			defer ticker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					r.Tick(ctx)
				}
			}
		}()

		logger.LegacyPrintf("service.iq_detection_runner", "[IQDetectionRunner] started (tick=%s)", iqDetectionRunnerTickInterval)
	})
}

// Stop 优雅停止后台轮询协程。
func (r *IQDetectionRunner) Stop() {
	if r == nil {
		return
	}
	r.stopOnce.Do(func() {
		if r.cancel != nil {
			r.cancel()
			select {
			case <-r.done:
			case <-time.After(3 * time.Second):
				logger.LegacyPrintf("service.iq_detection_runner", "[IQDetectionRunner] stop timed out")
			}
		}
	})
}

// Tick 单次检查并按需执行定时智商抽检。
func (r *IQDetectionRunner) Tick(parentCtx context.Context) {
	if r == nil || r.svc == nil {
		return
	}
	ctx, cancel := context.WithTimeout(parentCtx, iqDetectionRunnerPatrolTimeout)
	defer cancel()

	res, claimed, err := r.svc.RunScheduledPatrol(ctx, time.Now())
	if err != nil {
		logger.LegacyPrintf("service.iq_detection_runner", "[IQDetectionRunner] patrol error: %v", err)
		return
	}
	if claimed && res != nil {
		logger.LegacyPrintf(
			"service.iq_detection_runner",
			"[IQDetectionRunner] scheduled patrol completed: executed=%d skipped=%d",
			res.ExecutedGroups,
			len(res.SkippedInFlightGroups),
		)
	}
}
