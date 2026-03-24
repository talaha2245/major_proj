import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/**
 * Strip markdown formatting so spoken text sounds natural.
 * Removes: headers, bold/italic markers, links, images, code blocks, lists markers, etc.
 */
function stripMarkdown(text: string): string {
  return text
    // Remove code blocks (``` ... ```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code (`...`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove images ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove links [text](url) → keep text
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    // Remove headers (# ## ### etc.)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove list markers (- * 1. etc.)
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Collapse multiple newlines
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Split long text into chunks to work around Chrome's ~15-second utterance timeout.
 * Splits on sentence boundaries (. ! ?) to keep speech natural.
 */
function splitIntoChunks(text: string, maxLength = 200): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find the last sentence-ending punctuation within maxLength
    let splitIndex = -1;
    for (let i = Math.min(maxLength, remaining.length) - 1; i >= 0; i--) {
      if (remaining[i] === '.' || remaining[i] === '!' || remaining[i] === '?') {
        splitIndex = i + 1;
        break;
      }
    }

    // If no sentence boundary found, split at last space
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }

    // If still no good split point, just split at maxLength
    if (splitIndex <= 0) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks.filter(c => c.length > 0);
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const isStoppedRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  const stop = useCallback(() => {
    if (!isSupported) return;
    isStoppedRef.current = true;
    utteranceQueueRef.current = [];
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      // Cancel any ongoing speech
      stop();

      // Small delay to ensure cancel completes before new speech
      setTimeout(() => {
        isStoppedRef.current = false;

        const cleanText = stripMarkdown(text);
        if (!cleanText) return;

        const chunks = splitIntoChunks(cleanText);
        const utterances = chunks.map((chunk, index) => {
          const utterance = new SpeechSynthesisUtterance(chunk);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          utterance.onstart = () => {
            setIsSpeaking(true);
          };

          utterance.onend = () => {
            // If this is the last chunk, mark speaking as done
            if (index === chunks.length - 1) {
              setIsSpeaking(false);
              utteranceQueueRef.current = [];
            }
          };

          utterance.onerror = (event) => {
            // 'canceled' fires when we call stop() — not a real error
            if (event.error !== 'canceled') {
              console.warn('Speech synthesis error:', event.error);
            }
            setIsSpeaking(false);
            utteranceQueueRef.current = [];
          };

          return utterance;
        });

        utteranceQueueRef.current = utterances;

        // Queue all utterances
        utterances.forEach((u) => {
          if (!isStoppedRef.current) {
            window.speechSynthesis.speak(u);
          }
        });
      }, 50);
    },
    [isSupported, stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
