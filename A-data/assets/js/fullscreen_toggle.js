// Fullscreen Toggle Script
// Injects a floating button to toggle fullscreen mode

document.addEventListener('DOMContentLoaded', () => {
    // Create the button
    const btn = document.createElement('button');
    btn.id = 'fullscreenToggleBtn';
    btn.innerHTML = '⛶'; // Expand icon
    btn.title = 'ملء الشاشة';

    // Style the button
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px', // Move to bottom-left to be more accessible like a "taskbar" utility
        left: '20px',
        zIndex: '9999',
        backgroundColor: '#34495e', // Dark Blue-Grey
        color: 'white',
        border: '2px solid white', // White border for contrast
        borderRadius: '50%',
        width: '50px', // Larger
        height: '50px',
        fontSize: '24px', // Larger icon
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)', // Shadow for depth
        transition: 'transform 0.2s, background-color 0.3s',
    });

    // Hover effects
    btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = 'var(--primary-color)';
        btn.style.transform = 'scale(1.1)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = '#34495e';
        btn.style.transform = 'scale(1)';
    });

    // Helper to update icon
    const updateIcon = () => {
        if (document.fullscreenElement) {
            btn.innerHTML = '✖'; // Close/Contract icon
            btn.title = 'خروج من ملء الشاشة';
        } else {
            btn.innerHTML = '⛶';
            btn.title = 'ملء الشاشة';
        }
    };

    // Toggle logic
    btn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.error(`Error attempting to enable fullscreen: ${e.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });

    // Listen for system changes (e.g. user presses F11 or Esc)
    document.addEventListener('fullscreenchange', updateIcon);

    // Append to body
    document.body.appendChild(btn);
});
