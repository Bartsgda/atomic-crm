
import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    initialX?: number;
    initialY?: number;
    className?: string;
    headerContent?: React.ReactNode;
}

export const DraggablePanel: React.FC<Props> = ({ children, initialX = 50, initialY = 50, className = '', headerContent }) => {
    const [position, setPosition] = useState({ x: initialX, y: initialY });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number, startY: number, initialLeft: number, initialTop: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialLeft: position.x,
            initialTop: position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragRef.current) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            
            setPosition({
                x: dragRef.current.initialLeft + dx,
                y: dragRef.current.initialTop + dy
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragRef.current = null;
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div 
            className={`fixed z-[500] shadow-2xl rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 flex flex-col ${className}`}
            style={{ left: position.x, top: position.y }}
        >
            {/* Draggable Header */}
            <div 
                onMouseDown={handleMouseDown}
                className={`bg-zinc-100 dark:bg-zinc-800 p-2 cursor-grab active:cursor-grabbing flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 ${isDragging ? 'bg-zinc-200' : ''}`}
            >
                <div className="flex items-center gap-2 px-2 flex-1 overflow-hidden">
                    <GripHorizontal size={16} className="text-zinc-400 flex-shrink-0" />
                    {headerContent}
                </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
                {children}
            </div>
        </div>
    );
};
