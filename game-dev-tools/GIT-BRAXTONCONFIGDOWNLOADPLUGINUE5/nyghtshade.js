// Smooth scrolling for in-page links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
        const href = anchor.getAttribute('href');
        if (!href) return;
        const target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// Parallax drift on the background
const bg = document.querySelector('.bg-animation');
window.addEventListener('mousemove', event => {
    if (!bg) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 10;
    const y = (event.clientY / window.innerHeight - 0.5) * 10;
    bg.style.transform = `translate(${x}px, ${y}px)`;
});

// Reveal-on-scroll animations
const revealables = document.querySelectorAll('.feature-card, .pricing-card, .pill, .code-card, .step, .final-card');
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

revealables.forEach(el => observer.observe(el));

// Highlight cards on hover
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'var(--neon-cyan)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'var(--border)';
    });
});
