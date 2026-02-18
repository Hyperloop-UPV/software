export type BootloaderViewState =
    | EmptyState
    | SendState
    | AwaitingState
    | SuccessState
    | FailureState;

type EmptyState = {
    kind: "empty";
};

type SendState = {
    kind: "send";
    file: File;
};

type AwaitingState = {
    kind: "awaiting";
    progress: number; // Between 0 and 100
};

type SuccessState = {
    kind: "success";
};

type FailureState = {
    kind: "failure";
};
