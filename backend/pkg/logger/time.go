package logger

import (
	"fmt"
	"time"
)

type TimeUnit string

const (
	Nanoseconds  TimeUnit = "ns"
	Microseconds TimeUnit = "us"
	Milliseconds TimeUnit = "ms"
	Seconds      TimeUnit = "s"
)

// Function used by all the subloggers to format timestamps according to the selected unit, by default is microseconds
var FormatTimestamp = func(t time.Time) int64 { return t.UnixNano() }

// SetTimestampUnit sets the global timestamp unit for all loggers applying functions as objects of first class

func SetFormatTimestamp(unit TimeUnit) {

	switch unit {
	case Nanoseconds:
		FormatTimestamp = func(t time.Time) int64 { return t.UnixNano() }
	case Microseconds:
		FormatTimestamp = func(t time.Time) int64 { return t.UnixMicro() }
	case Milliseconds:
		FormatTimestamp = func(t time.Time) int64 { return t.UnixMilli() }
	case Seconds:
		FormatTimestamp = func(t time.Time) int64 { return t.Unix() }
	default:
		fmt.Printf("Unknown time unit: %s.\n", unit)
	}
}

// SetTimestampUnit sets the global timestamp unit for all loggers
