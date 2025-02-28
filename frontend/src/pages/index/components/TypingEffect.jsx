import React, { useEffect, useState, useRef } from 'react';

function TypingEffect() {
    const [text, setText] = useState('');
    const fullText = "etworks.";
    const indexRef = useRef(0);
    const isTypingRef = useRef(true);
    const textRef = useRef('');

    useEffect(() => {
        const typingInterval = setInterval(() => {
            if (isTypingRef.current) {
                textRef.current = textRef.current + fullText[indexRef.current];
                setText(textRef.current);
                indexRef.current += 1;

                if (indexRef.current === fullText.length) {
                    isTypingRef.current = false;
                    setTimeout(() => {
                        textRef.current = ''; 
                        setText(''); 
                        indexRef.current = 0; 
                        isTypingRef.current = true; 
                    }, 2000);
                }
            }
        }, 320);

        return () => clearInterval(typingInterval); 
    }, []);

    return (
        <>
            <span className="relative text-blue-600">N{text}</span>
        </>
    );
}

export default TypingEffect;
