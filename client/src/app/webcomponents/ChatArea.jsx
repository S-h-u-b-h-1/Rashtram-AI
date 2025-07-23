"use client";
import React, { useState, useContext, useEffect, useRef } from "react";
import { ChatContext } from "../../context/Chatcontext";

const ChatArea = () => {
  const chatState = useContext(ChatContext);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatState.chat]);

  return (
    <div className="flex-grow overflow-y-auto p-4">
      <div className="flex flex-col space-y-2 w-full mx-auto overflow-scroll h-[70vh]">
        {chatState.chat &&
          chatState.chat.map((item, index) => (
            <div
              key={index}
              className={`flex ${item.name === 'user' ? 'justify-end' : 'justify-start'} mx-3 mb-6`}>
              <div className={`p-3 rounded-lg ${item.name === 'user' ? 'bg-[#212121] text-white' : 'bg-[#d8d8d8] text-black'} ${item.name === 'AI' ? 'w-[70%]' : 'max-w-xs lg:max-w-md'}`}>
                {item.name === 'System' && (
                  <span className="font-bold">System:</span>
                )}
                <span className="whitespace-pre-wrap">{item.message}</span>
                <div ref={chatEndRef} />
              </div>
            </div>
          ))}
        {chatState.loading && <div className="text-gray-500">Thinking...</div>}
      </div>
    </div>
  );
};

export default ChatArea;
