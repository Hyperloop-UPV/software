package common

func Clamp[N Numeric](number, lower, upper N) N {
	if number < lower {
		return lower
	} else if number > upper {
		return upper
	} else {
		return number
	}
}
