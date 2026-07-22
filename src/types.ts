// Interface defining chat history information
interface ChatItem {
    id: string;      // Unique ID obtained from URL, etc.
    title: string;   // Chat title
}

// Interface defining folder information
interface Folder {
    id: string;
    name: string;
    chats: ChatItem[]; // Array of ChatItem
}