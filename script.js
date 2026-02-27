// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe all feature cards, provider cards, and sections
    document.querySelectorAll('.feature-card, .provider-card, .doc-card, .timeline-item').forEach(el => {
        observer.observe(el);
    });
    
    // Typing animation for hero code
    const heroCode = document.getElementById('hero-code');
    const visualizer = document.getElementById('code-visualizer');
    
    if (heroCode && visualizer) {
        const codeText = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);`;
        
        const codeElement = heroCode.querySelector('code');
        let charIndex = 0;
        
        function typeCharacter() {
            if (charIndex < codeText.length) {
                const char = codeText[charIndex];
                codeElement.textContent += char;
                charIndex++;
                
                // Variable speed - faster for spaces, slower for other chars
                const speed = char === ' ' ? 30 : (char === '\n' ? 10 : 60);
                setTimeout(typeCharacter, speed);
            } else {
                // Apply syntax highlighting after typing is done
                setTimeout(() => {
                    codeElement.innerHTML = `<span class="keyword">function</span> <span class="function fib-call" data-index="0">fibonacci</span>(<span class="param">n</span>) {
  <span class="keyword">if</span> (n &lt;= <span class="number">1</span>) <span class="keyword">return</span> n;
  <span class="keyword">return</span> <span class="function fib-call" data-index="1">fibonacci</span>(n - <span class="number">1</span>) + <span class="function fib-call" data-index="2">fibonacci</span>(n - <span class="number">2</span>);
}

<span class="keyword">const</span> result = <span class="function fib-call" data-index="3">fibonacci</span>(<span class="number">10</span>);`;
                    
                    // Wait a bit then draw connections
                    setTimeout(drawConnections, 500);
                }, 500);
            }
        }
        
        function drawConnections() {
            const fibCalls = codeElement.querySelectorAll('.fib-call');
            if (fibCalls.length === 0) return;
            
            // Get positions of all fibonacci calls
            const positions = Array.from(fibCalls).map((el, idx) => {
                const rect = el.getBoundingClientRect();
                const containerRect = heroCode.getBoundingClientRect();
                return {
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top + rect.height / 2 + (idx === 10 ? 40 : 40), // Bring down first node beneath the word
                    index: el.dataset.index
                };
            });
            
            // Draw lines connecting function definition to calls
            const svg = visualizer;
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            
            let lineDelay = 0;
            // Connect definition (0) to first call (1)
            if (positions[0] && positions[1]) {
                createLine(svg, positions[0], positions[1], lineDelay);
                createNode(svg, positions[1], lineDelay + 300);
                lineDelay += 600;
            }
            
            // Connect first call (1) to second call (2)
            if (positions[1] && positions[2]) {
                createLine(svg, positions[1], positions[2], lineDelay);
                createNode(svg, positions[2], lineDelay + 300);
                lineDelay += 600;
            }
            
            // Connect to last call (3)
            if (positions[2] && positions[3]) {
                createLine(svg, positions[2], positions[3], lineDelay);
                createNode(svg, positions[3], lineDelay + 300);
            }
        }
        
        function createLine(svg, start, end, delay) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', start.x);
            line.setAttribute('y1', start.y);
            line.setAttribute('x2', end.x);
            line.setAttribute('y2', end.y);
            line.setAttribute('class', 'viz-line');
            line.style.animationDelay = `${delay}ms`;
            svg.appendChild(line);
        }
        
        function createNode(svg, pos, delay) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            circle.setAttribute('r', '5');
            circle.setAttribute('class', 'viz-node');
            circle.style.animationDelay = `${delay}ms`;
            svg.appendChild(circle);
        }
        
        // Start typing after a delay
        setTimeout(typeCharacter, 1000);
    }
    
    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.background = 'rgba(15, 23, 42, 0.95)';
            navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(15, 23, 42, 0.8)';
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });
    
    // Parallax effect for hero section
    const hero = document.querySelector('.hero');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        if (hero && scrolled < window.innerHeight) {
            hero.style.transform = `translateY(${scrolled * 0.5}px)`;
            hero.style.opacity = 1 - (scrolled / window.innerHeight);
        }
    });
    
    // Stats counter animation
    const animateCounter = (element, target, duration = 2000) => {
        let start = 0;
        const increment = target / (duration / 16);
        
        const updateCounter = () => {
            start += increment;
            if (start < target) {
                element.textContent = Math.ceil(start);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        };
        
        updateCounter();
    };
    
    // Trigger counter animation when stats section is visible
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach(stat => {
                    const target = parseInt(stat.textContent);
                    if (!isNaN(target)) {
                        animateCounter(stat, target);
                    }
                });
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        statsObserver.observe(heroStats);
    }
    
    // Language card interaction
    document.querySelectorAll('.language-card:not(.coming-soon)').forEach(card => {
        card.addEventListener('click', () => {
            const language = card.querySelector('span').textContent;
            console.log(`Selected language: ${language}`);
            // You could add more interaction here, like opening docs for that language
        });
    });
    
    // Provider card interaction
    document.querySelectorAll('.provider-card').forEach(card => {
        card.addEventListener('click', () => {
            const provider = card.querySelector('h3').textContent;
            console.log(`Selected provider: ${provider}`);
            // You could add modal or navigation here
        });
    });
    
    // Copy code snippet on click
    document.querySelectorAll('.code-snippet code').forEach(codeBlock => {
        codeBlock.style.cursor = 'pointer';
        codeBlock.title = 'Click to copy';
        
        codeBlock.addEventListener('click', async () => {
            const text = codeBlock.textContent;
            try {
                await navigator.clipboard.writeText(text);
                
                // Visual feedback
                const originalText = codeBlock.textContent;
                codeBlock.textContent = '✓ Copied!';
                codeBlock.style.color = '#10b981';
                
                setTimeout(() => {
                    codeBlock.textContent = originalText;
                    codeBlock.style.color = '';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
    
    // Feature card hover effect - show more details
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    });
    
    // Easter egg: Konami code
    let konamiCode = [];
    const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    
    document.addEventListener('keydown', (e) => {
        konamiCode.push(e.key);
        konamiCode = konamiCode.slice(-10);
        
        if (konamiCode.join(',') === konamiSequence.join(',')) {
            document.body.style.animation = 'rainbow 5s linear infinite';
            setTimeout(() => {
                document.body.style.animation = '';
            }, 5000);
        }
    });
    
    // Add CSS for rainbow animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rainbow {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
        }
        
        .nav-menu.active {
            display: flex;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(15, 23, 42, 0.98);
            flex-direction: column;
            padding: 2rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        
        .hamburger.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }
        
        .hamburger.active span:nth-child(2) {
            opacity: 0;
        }
        
        .hamburger.active span:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -6px);
        }
    `;
    document.head.appendChild(style);
});

// Loading animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease-in';
        document.body.style.opacity = '1';
    }, 100);
});

// Prevent animation on page refresh
window.addEventListener('beforeunload', () => {
    document.body.style.opacity = '0';
});

// Console message for developers
console.log('%c🌌 Vertex - The Visual Learning IDE', 'font-size: 20px; font-weight: bold; color: #6366f1;');
console.log('%cInterested in contributing? Check out our GitHub!', 'font-size: 14px; color: #94a3b8;');
console.log('%chttps://github.com/dev0root6/Vertex-code-IDE/', 'font-size: 12px; color: #8b5cf6;');
