import { PromptBox } from "@/components/ui/chatgpt-prompt-input";
import { ChatContext } from "@/context/Chatcontext";
import { useContext } from "react";
import ChatArea from './ChatArea'
export function PromptBoxDemo() {
  const chatState = useContext(ChatContext);
  return (
    <div className={` ${!chatState.firstSent ? 'min-h-[80vh]' : ''} flex w-full flex-col items-center justify-center bg-background dark:bg-[#212121] p-4 pt-0`}>
      <div className="w-full flex flex-col gap-10">
          {!chatState.firstSent && <p className="text-center text-3xl text-foreground">
            How Can I Help You
          </p>}
          {chatState.firstSent && <ChatArea />}
          <div className="mw-xl flex justify-center">
          <PromptBox className = {`${chatState.firstSent ? 'fixed bottom-10 w-xl': 'w-xl'} transition-all duration-300`} />
          </div>
      </div>
    </div>
  );
}