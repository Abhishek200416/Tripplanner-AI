import React from 'react';

export function CustomSelect({ id, label, value, options = [], onChange, disabled }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(Math.max(0, options.findIndex(o => o.value === value)));
  const btnRef = React.useRef(null);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    const i = Math.max(0, options.findIndex(o => o.value === value));
    setActive(i);
  }, [value, options]);

  // close on outside click/esc when popup is open
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e){
      if (!btnRef.current || !listRef.current) return;
      if (!btnRef.current.contains(e.target) && !listRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e){ if (e.key === 'Escape') { setOpen(false); btnRef.current && btnRef.current.focus(); } }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  function commit(i) {
    const v = options[i] && options[i].value;
    if (v == null) return;
    onChange && onChange(v);
    setOpen(false);
    btnRef.current && btnRef.current.focus();
  }

  function onKey(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); e.preventDefault(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(active); }
  }

  return React.createElement('div', { className: 'cs' }, [
    label ? React.createElement('label', { key: 'l', htmlFor: id, className: 'cs-label' }, label) : null,

    React.createElement('button', {
      key: 'b', id, ref: btnRef, type: 'button',
      className: 'cs-btn' + (disabled ? ' disabled' : ''),
      'aria-haspopup': 'listbox', 'aria-expanded': open, disabled,
      onClick: () => !disabled && setOpen(o => !o),
      onKeyDown: onKey
    }, [
      React.createElement('span', { key: 'v', className: 'cs-value' },
        (options.find(o => o.value === value) || options[0] || {}).label || 'Select'
      ),
      React.createElement('span', { key: 'c', className: 'cs-caret', 'aria-hidden': true }, '▾')
    ]),

    open ? React.createElement('ul', {
      key: 'p', ref: listRef, className: 'cs-pop', role: 'listbox',
      'aria-activedescendant': `opt-${id}-${active}`, tabIndex: -1, onKeyDown: onKey
    }, options.map((o, i) => React.createElement('li', {
      key: String(o.value), id: `opt-${id}-${i}`, role: 'option',
      'aria-selected': value === o.value,
      className: 'cs-opt' + (i === active ? ' active' : '') + (value === o.value ? ' selected' : ''),
      onMouseDown: e => e.preventDefault(), // keep focus
      onClick: () => commit(i)
    }, [
      React.createElement('span', { key: 'r', className: 'cs-radio', 'aria-hidden': true }),
      React.createElement('span', { key: 't', className: 'cs-label-text' }, o.label)
    ]))) : null
  ]);
}

export default CustomSelect;
