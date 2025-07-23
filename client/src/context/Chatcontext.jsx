"use client";

import React, { createContext, useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
export const ChatContext = createContext();
const ChatProvider = (props) => {
    // console.log(process.env.NEXT_PUBLIC_GEMINI_API_KEY)
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firstSent, setFirstSent] = React.useState(false);
  const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

  useEffect(() => {
    function formatData(rawText) {
      let formatted = rawText;
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, (_, match) => {
        return `\x1b[1m${match}\x1b[0m`;
      });
      formatted = formatted.replace(/\x1B\[[0-9;]*m/g, "");
      formatted = formatted
        .split("\n")
        .map((line) => {
          if (line.trim().startsWith("* ")) {
            return line.replace("* ", "• ");
          }
          return line;
        })
        .join("\n");

      formatted = formatted.replace(/\n{3,}/g, "\n\n");

      return formatted;
    }

    const fetcher = async () => {
      setLoading(true);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          "You are RashtramAI, Rashtram AI is a platform that helps you create and manage your public policy. It is a platform that helps you create and manage your public policy. You are Based on Indian Rules and constitution.",
          chat[chat.length - 1].message,
        ],
      });
      setLoading(false);
      console.log(response.text);
      if (response.text) {
        const newData = formatData(response.text);
        setChat([...chat, { name: "AI", message: newData }]);
      } else {
        setChat([
          ...chat,
          {
            name: "System",
            message: "There was an error sending your request.",
          },
        ]);
      }
    };
    if (chat.length > 0 && chat[chat.length - 1].name === "user") {
      fetcher();
    }
  }, [chat]);
  return (
    <ChatContext.Provider value={{ chat, setChat, loading, setLoading, firstSent, setFirstSent }}>
      {props.children}
    </ChatContext.Provider>
  );
};

export default ChatProvider;
