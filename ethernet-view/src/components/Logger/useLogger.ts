import { useSubscribe, useWsHandler } from "common";
import { useState } from "react";
import { useMeasurementsStore } from "common";

export function useLogger() {
    const [state, setState] = useState(false);

    const handler = useWsHandler();

    function getLoggedVariableIds() {
        return useMeasurementsStore.getState().getLogVariables();
    }

    function startLogging() {
        const variables = getLoggedVariableIds();
        handler.post("logger/variables", variables);
        handler.post("logger/enable", true);
    }

    function stopLogging() {
        handler.post("logger/enable", false);
    }

    useSubscribe("logger/response", (result) => {
        setState(result);
    });

    return [state, startLogging, stopLogging] as const;
}
