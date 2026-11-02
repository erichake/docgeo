// What TypeScript's DOM types lack of Chromium's File System Access and
// File Handling APIs.

interface FilePickerOptions {
    id?: string;
    multiple?: boolean;
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
    launchQueue?: {
        setConsumer(
            consumer: (params: { files: FileSystemFileHandle[] }) => void,
        ): void;
    };
}

interface FileSystemHandle {
    requestPermission(descriptor: {
        mode: "read" | "readwrite";
    }): Promise<PermissionState>;
}

interface DataTransferItem {
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}
