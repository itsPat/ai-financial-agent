import { Message } from "../types/message";

export default function formatMessages(messages: Message[], count?: number) {
  return (count ? messages.slice(-count) : messages)
    .map(
      (m) =>
        `${m.role.toUpperCase} (${new Date(m.date).toLocaleTimeString()}): ${
          m.content
        }`
    )
    .join("\n");
}
