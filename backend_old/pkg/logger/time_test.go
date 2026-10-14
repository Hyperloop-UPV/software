package logger

import (
	"testing"
	"time"
)

func TestSetFormatTimestampWithFixedTime(t *testing.T) {
	prev := FormatTimestamp
	defer func() { FormatTimestamp = prev }()

	// tiempo fijo para todas las comprobaciones (evita condiciones de carrera)
	t0 := time.Unix(1600000000, 123456789) // constante y reproducible

	tests := []struct {
		name string
		unit TimeUnit
		want func(time.Time) int64
	}{
		{"nanoseconds", Nanoseconds, func(t time.Time) int64 { return t.UnixNano() }},
		{"microseconds", Microseconds, func(t time.Time) int64 { return t.UnixMicro() }},
		{"milliseconds", Milliseconds, func(t time.Time) int64 { return t.UnixMilli() }},
		{"seconds", Seconds, func(t time.Time) int64 { return t.Unix() }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			SetFormatTimestamp(tt.unit)
			got := FormatTimestamp(t0)
			want := tt.want(t0)
			if got != want {
				t.Fatalf("unit %s: got %d want %d", tt.unit, got, want)
			}
		})
	}
}

func TestUnknownUnitDoesNotChangePrevious(t *testing.T) {
	prev := FormatTimestamp
	defer func() { FormatTimestamp = prev }()

	// establecer una función conocida primero
	SetFormatTimestamp(Nanoseconds)
	t0 := time.Unix(1600000000, 123456789)
	expected := FormatTimestamp(t0)

	// intentar con unidad desconocida
	SetFormatTimestamp(TimeUnit("unknown-unit"))
	got := FormatTimestamp(t0)
	if got != expected {
		t.Fatalf("unknown unit changed FormatTimestamp: got %d want %d", got, expected)
	}
}
