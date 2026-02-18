import {
    ColorType,
    createChart,
    IChartApi,
    UTCTimestamp,
} from 'lightweight-charts';
import { ChartPoint } from 'pages/LoggerPage/LogsColumn/LogLoader/LogsProcessor';
import { useEffect, useRef } from 'react';
import { MeasurementLogger } from './ChartElement';

const CHART_HEIGHT = 300;

interface Props {
    measurementsInChart: MeasurementLogger[];
    getDataFromLogSession: (measurement: string) => ChartPoint[];
}

export const ChartCanvas = ({
    measurementsInChart,
    getDataFromLogSession,
}: Props) => {
    const chart = useRef<IChartApi | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    // Helper function to get theme-aware chart options
    const getThemeOptions = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            layout: {
                background: { 
                    type: ColorType.Solid, 
                    color: isDark ? 'black' : 'white' 
                },
                textColor: isDark ? 'white' : 'black',
            },
            grid: {
                vertLines: {
                    color: isDark ? '#1f1f1f' : '#f0f0f0',
                },
                horzLines: {
                    color: isDark ? '#1f1f1f' : '#f0f0f0',
                },
            },
        };
    };

    useEffect(() => {
        const handleResize = () => {
            if (chartContainerRef.current)
                if (chart)
                    chart.current?.applyOptions({
                        width: chartContainerRef.current.clientWidth,
                    });
        };

        const resizeObserver = new ResizeObserver(handleResize);
        if (chartContainerRef.current)
            resizeObserver.observe(chartContainerRef.current);

        let themeObserver: MutationObserver | null = null;

        if (chartContainerRef.current) {
            if (chart)
                chart.current = createChart(chartContainerRef.current, {
                    ...getThemeOptions(),
                    width: chartContainerRef.current.clientWidth,
                    height: CHART_HEIGHT,
                    timeScale: {
                        timeVisible: true,
                        fixLeftEdge: true,
                        fixRightEdge: true,
                        lockVisibleTimeRangeOnResize: true,
                        tickMarkFormatter: (time: UTCTimestamp) => {
                            const date = new Date(time * 1000);
                            return date.toLocaleTimeString() + '.' + date.getMilliseconds();
                        },    
                    },
                    localization: {
                        timeFormatter: (time: UTCTimestamp) => {
                            const date = new Date(time * 1000);
                            return date.toLocaleTimeString() + '.' + date.getMilliseconds();
                        }
                    }
                });

            // Set up MutationObserver to watch for theme changes
            themeObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                        chart.current?.applyOptions(getThemeOptions());
                    }
                });
            });

            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }

        for (const measurement of measurementsInChart) {
            const data = getDataFromLogSession(measurement.id);
            const series = chart.current?.addLineSeries({
                color: measurement.color,
                priceFormat: {
                    type: 'price',
                    precision: 3,
                    minMove: 0.001,
                },
            });
            for (const point of data) {
                series?.update({
                    time: (point.time / 1000) as UTCTimestamp,
                    value: point.value,
                });
            }
        }

        return () => {
            resizeObserver.disconnect();
            themeObserver?.disconnect();
            chart.current?.remove();
        };
    }, [measurementsInChart]);

    return <div ref={chartContainerRef}></div>;
};
