import React, { useState, useRef } from 'react';
import './Tooltip.css';

/**
 * Lightweight tooltip component with fast response time
 *
 * @param children - The text content that will have a dotted underline
 * @param content - The tooltip content to display
 *
 * @example
 * ```tsx
 * <Tooltip content="This is helpful information">
 *   Hover me
 * </Tooltip>
 * ```
 */
interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export default function Tooltip({ children, content }: TooltipProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef<HTMLElement>(null);

  return (
    <span className="tooltip-container">
      <abbr
        ref={wrapperRef}
        className="tooltip-wrapper"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </abbr>
      {isVisible && (
        <span className="tooltip-bubble">
          {content}
        </span>
      )}
    </span>
  );
}
