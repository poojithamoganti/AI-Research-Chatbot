export type Source = {
    url: string;
    content: string;
    title?: string;
  };
  
  export type Message = {
    role: "user" | "ai";
    content: string;
    sources?: Source[];
  };
  
  export type Conversation = {
    id: string;
    messages: Message[];
    urls: string;
  };