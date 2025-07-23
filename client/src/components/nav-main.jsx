"use client"

import { ChevronRight, MessageSquare } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items
}) {
  console.log(items)
  return (
    <SidebarGroup>
      <SidebarGroupLabel><MessageSquare className="mx-2"/>Chats</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
            <SidebarMenuItem>
              <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title} className={'cursor-pointer'}>
                      <SidebarMenuSubButton asChild>
                        <a href={subItem.url}>
                          <span>{subItem.title}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
            </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
