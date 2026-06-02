window.StudentListUI = (function () {
    function getActionDropdownMenu(toggle) {
        if (!toggle) return null;

        var dropdownRoot = toggle.closest('.dropdown');
        return dropdownRoot ? dropdownRoot.querySelector('.dropdown-menu') : null;
    }

    function positionActionDropdownMenu(toggle, menu) {
        if (!toggle || !menu) return;

        var toggleRect = toggle.getBoundingClientRect();
        var menuRect = menu.getBoundingClientRect();
        var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        var margin = 12;
        var spacing = 6;
        var isDropup = !!toggle.closest('.dropup');
        var preferredLeft = document.documentElement.dir === 'rtl'
            ? toggleRect.right - menuRect.width
            : toggleRect.left;

        var left = Math.min(
            Math.max(margin, preferredLeft),
            Math.max(margin, viewportWidth - menuRect.width - margin)
        );

        var top = isDropup
            ? toggleRect.top - menuRect.height - spacing
            : toggleRect.bottom + spacing;

        if (top + menuRect.height > viewportHeight - margin) {
            top = toggleRect.top - menuRect.height - spacing;
        }

        if (top < margin) {
            top = Math.max(margin, viewportHeight - menuRect.height - margin);
        }

        menu.style.position = 'fixed';
        menu.style.inset = 'auto auto auto auto';
        menu.style.top = String(Math.round(top)) + 'px';
        menu.style.left = String(Math.round(left)) + 'px';
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
        menu.style.zIndex = '2000';
    }

    function detachActionDropdownMenu(toggle) {
        var menu = getActionDropdownMenu(toggle);
        if (!menu || menu.dataset.portalDetached === 'true') return;

        menu.__portalParent = menu.parentNode;
        menu.__portalNextSibling = menu.nextSibling;
        menu.__portalToggleRef = toggle;
        document.body.appendChild(menu);
        menu.dataset.portalDetached = 'true';
        menu.classList.add('student-actions-menu-portal');
        positionActionDropdownMenu(toggle, menu);
    }

    function restoreActionDropdownMenu(toggle) {
        var menu = getActionDropdownMenu(toggle) || toggle.__portalMenuRef;
        if (!menu || menu.dataset.portalDetached !== 'true') return;

        var parent = menu.__portalParent;
        var nextSibling = menu.__portalNextSibling;

        if (parent) {
            if (nextSibling && nextSibling.parentNode === parent) {
                parent.insertBefore(menu, nextSibling);
            } else {
                parent.appendChild(menu);
            }
        }

        menu.dataset.portalDetached = 'false';
        menu.classList.remove('student-actions-menu-portal');
        menu.style.position = '';
        menu.style.inset = '';
        menu.style.top = '';
        menu.style.left = '';
        menu.style.right = '';
        menu.style.bottom = '';
        menu.style.zIndex = '';
    }

    function bindActionDropdownPortal(toggle) {
        if (!toggle || toggle.dataset.portalBound === 'true') return;

        var shownHandler = function () {
            var menu = getActionDropdownMenu(toggle);
            toggle.__portalMenuRef = menu;
            detachActionDropdownMenu(toggle);
        };

        var hideHandler = function () {
            restoreActionDropdownMenu(toggle);
        };

        toggle.addEventListener('shown.bs.dropdown', shownHandler);
        toggle.addEventListener('hide.bs.dropdown', hideHandler);
        toggle.dataset.portalBound = 'true';
    }

    function createActionDropdownInstance(toggle) {
        bindActionDropdownPortal(toggle);

        var existing = bootstrap.Dropdown.getInstance(toggle);
        if (existing) {
            existing.dispose();
        }

        return new bootstrap.Dropdown(toggle, {
            popperConfig: {
                strategy: 'fixed',
                modifiers: [
                    { name: 'preventOverflow', options: { boundary: 'viewport' } },
                    { name: 'flip', options: { fallbackPlacements: ['top-end', 'bottom-end'] } }
                ]
            }
        });
    }

    function closeOpenActionDropdowns(scope) {
        if (!scope) return;

        Array.from(scope.querySelectorAll('[data-bs-toggle="dropdown"].show')).forEach(function (toggle) {
            var instance = bootstrap.Dropdown.getInstance(toggle);
            if (instance) {
                instance.hide();
            } else {
                toggle.classList.remove('show');
            }
        });

        Array.from(scope.querySelectorAll('.dropdown-menu.show')).forEach(function (menu) {
            menu.classList.remove('show');
        });
    }

    return {
        createActionDropdownInstance: createActionDropdownInstance,
        closeOpenActionDropdowns: closeOpenActionDropdowns
    };
})();
