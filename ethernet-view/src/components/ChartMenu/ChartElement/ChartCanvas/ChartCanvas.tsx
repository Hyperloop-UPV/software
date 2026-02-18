import {
  MeasurementId,
  NumericMeasurementInfo,
  UpdateFunctionNumeric,
  useGlobalTicker,
} from "common";
import {
  ColorType,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  createChart,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type DataSerieAndUpdater = Map<
  MeasurementId,
  [ISeriesApi<"Line">, UpdateFunctionNumeric]
>;

interface Props {
  measurementsInChart: NumericMeasurementInfo[];
}

const CHART_HEIGHT = 300;

export const ChartCanvas = ({ measurementsInChart }: Props) => {
  const chart = useRef<IChartApi | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartDataSeries = useRef<DataSerieAndUpdater>(new Map());

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
      if (chartContainerRef.current && chart.current) {
        chart.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    let themeObserver: MutationObserver | null = null;

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);

      chart.current = createChart(chartContainerRef.current, {
        ...getThemeOptions(),
        width: chartContainerRef.current.clientWidth,
        height: CHART_HEIGHT,
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 12,
          barSpacing: 0.1,
          tickMarkFormatter: (time: UTCTimestamp) => {
            const date = new Date(time * 1000);
            return date.toLocaleTimeString() + "." + date.getMilliseconds();
          },
        },
        localization: {
          timeFormatter: (time: UTCTimestamp) => {
            const date = new Date(time * 1000);
            return date.toLocaleTimeString() + "." + date.getMilliseconds();
          },
        },
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

    return () => {
      resizeObserver.disconnect();
      themeObserver?.disconnect();
      chart.current?.remove();
    };
  }, []);

  useEffect(() => {
    chartDataSeries.current.clear();
    measurementsInChart.forEach((measurement) => {
      if (chart.current)
        chartDataSeries.current.set(measurement.id, [
          chart.current.addLineSeries({
            color: measurement.color,
            priceFormat: {
              type: "price",
              precision: 3,
              minMove: 0.001,
            },
          }),
          measurement.getUpdate,
        ]);
    });
  });

  useGlobalTicker(() => {
    const now = (Date.now() / 1000) as UTCTimestamp;
    chartDataSeries.current?.forEach((serieAndUpdater) => {
      const [DataSerie, Updater] = serieAndUpdater;
      DataSerie.update({ time: now, value: Updater() });
    });
  });

  return <div ref={chartContainerRef}></div>;
};
