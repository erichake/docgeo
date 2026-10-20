// What TypeScript's DOM types lack of Chromium's File System Access API.

interface FilePickerOptions {
    id?: string;
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
}

interface Window {
    showOpenFilePicker?(
        options?: FilePickerOptions,
    ): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(
        options?: FilePickerOptions,
    ): Promise<FileSystemFileHandle>;
}

interface FileSystemHandle {
    requestPermission(descriptor: {
        mode: "read" | "readwrite";
    }): Promise<PermissionState>;
}

interface DataTransferItem {
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}
