export function mustFindIndex<T>(
    elements: T[],
    predicate: (element: T) => boolean
): number {
    const index = elements.findIndex((element) => predicate(element));

    if (index == -1) {
        console.error("element not found");
    }

    return index;
}
