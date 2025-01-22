import { transparentize } from 'polished';
import {
  MouseEventHandler,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { styled } from 'styled-components';

interface UseResizeResult {
  size: string;
  dragAreaRef: React.RefObject<HTMLDivElement | null>;
  dragAreaListeners: Pick<React.DOMAttributes<HTMLDivElement>, 'onMouseDown'>;
  isDragging: boolean;
}

const dragRule = `
 * {
  cursor: col-resize;
  user-select: none;
  pointer-events: none;
 }
`;

function createStyleElement(id: string) {
  const existingNode = document.getElementById(id);

  if (existingNode) {
    return existingNode;
  }

  const node = document.createElement('style');
  node.setAttribute('id', id);
  document.head.appendChild(node);

  return node;
}

function cleanup(id: string) {
  const node = document.getElementById(id);
  if (!node) return;

  if (document.head.contains(node)) {
    document.head.removeChild(node);
  }
}

function setDragStyling(id: string, enable: boolean) {
  const node = createStyleElement(id);

  if (enable) {
    node.innerHTML = dragRule;
  } else {
    node.innerHTML = '';
  }
}

export type UseResizableProps<E extends HTMLElement> = {
  initialSize: number;
  onResize?: (size: number) => void;
  minSize?: number;
  maxSize?: number;
  targetRef: React.RefObject<E | null>;
};

export function useResizable<E extends HTMLElement>({
  initialSize,
  onResize,
  minSize = 0,
  maxSize = Infinity,
  targetRef,
}: UseResizableProps<E>): UseResizeResult {
  const dragAreaRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState(false);

  const [size, setSize] = useState(`${initialSize}px`);
  const styleId = useId();

  // Needed because mouseMove requires a stable reference
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const mouseMove = useRef((e: MouseEvent) => {
    const targetRect = targetRef.current?.getBoundingClientRect();
    const relativePosition = e.clientX - (targetRect?.x ?? 0);
    const newSize = Math.min(maxSize, Math.max(minSize, relativePosition));

    requestAnimationFrame(() => {
      setSize(`${newSize}px`);
      onResizeRef.current?.(newSize);
    });
  });

  const onMouseDown: MouseEventHandler<HTMLDivElement> = useCallback(e => {
    e.stopPropagation();

    if (e.target !== dragAreaRef.current) return;

    setDragging(true);
  }, []);

  useEffect(() => {
    if (!targetRef.current || !dragAreaRef.current) {
      return () => {
        cleanup(styleId);
      };
    }

    const mouseUp = () => {
      setDragging(false);
    };

    window.addEventListener('mouseup', mouseUp);

    return () => {
      window.removeEventListener('mouseup', mouseUp);
      cleanup(styleId);
    };
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', mouseMove.current);
      setDragStyling(styleId, true);
    } else {
      window.removeEventListener('mousemove', mouseMove.current);
      setDragStyling(styleId, false);
    }

    return () => {
      window.removeEventListener('mousemove', mouseMove.current);
    };
  }, [dragging]);

  return {
    size,
    dragAreaRef,
    isDragging: dragging,
    dragAreaListeners: {
      onMouseDown,
    },
  };
}

interface DragAreaBaseProps {
  isDragging: boolean;
}

export const DragAreaBase = styled.div<DragAreaBaseProps>`
  --drag-color: ${p => transparentize(0.7, p.theme.colors.main)};
  position: absolute;
  cursor: col-resize;

  background-color: ${({ isDragging }) =>
    isDragging ? 'var(--drag-color)' : 'transparent'};

  backdrop-filter: ${({ isDragging }) => (isDragging ? 'blur(5px)' : 'none')};

  &:hover {
    transition: background-color 0.2s;
    background-color: var(--drag-color);
    backdrop-filter: blur(5px);
  }

  border-radius: ${({ theme }) => theme.radius};
`;
