/** Account-scoped state storage supplied by the common Expo runtime. */
export declare function loadState(bookId: string): unknown;
export declare function saveState(state: unknown, bookId: string): void;
export declare function clearState(bookId: string): Promise<void>;
