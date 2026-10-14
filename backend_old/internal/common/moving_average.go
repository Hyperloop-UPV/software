package common

type MovingAverage[N Numeric] struct {
	buf     RingBuf[N]
	length  int
	currAvg float64
}

func NewMovingAverage[N Numeric](order uint) *MovingAverage[N] {
	return &MovingAverage[N]{
		buf:     NewRingBuf[N]((int)(order)),
		length:  0,
		currAvg: 0,
	}
}

func (avg *MovingAverage[N]) Add(value N) N {
	if avg == nil {
		return 0
	}

	if avg.length < avg.Order() {
		avg.addElem(value)
	} else {
		rem := avg.buf.Add(value)
		avg.currAvg -= float64(rem) / float64(avg.Order())
		avg.currAvg += float64(value) / float64(avg.Order())
	}

	return N(avg.currAvg)
}

func (avg *MovingAverage[N]) addElem(value N) {
	prevLength := avg.length
	avg.length += 1
	avg.buf.Add(value)
	avg.currAvg = (float64(prevLength)*avg.currAvg + float64(value)) / float64(avg.length)
}

func (avg *MovingAverage[N]) Order() int {
	return avg.buf.Len()
}

func (avg *MovingAverage[N]) Resize(order uint) N {
	if avg == nil {
		return 0
	}

	if order > uint(avg.Order()) {
		avg.Grow(order - uint(avg.Order()))
	} else if order < uint(avg.Order()) {
		avg.Shrink(uint(avg.Order()) - order)
	}

	return N(avg.currAvg)
}

func (avg *MovingAverage[N]) Shrink(amount uint) N {
	avg.currAvg *= float64(avg.Order())
	for _, removed := range avg.buf.Shrink(amount) {
		avg.currAvg -= float64(removed)
	}
	avg.currAvg /= float64(avg.Order())
	avg.length = avg.Order()

	return N(avg.currAvg)
}

func (avg *MovingAverage[N]) Grow(amount uint) N {
	avg.buf.Grow(amount)

	return N(avg.currAvg)
}
