import React from 'react';
import '../styles/Toast.css';

let push;
export function useToasts() {
  const [, setTick] = React.useState(0);
  const [items, setItems] = React.useState([]);
  React.useEffect(() => { push = (msg, kind='info') => {
    const id = Math.random().toString(36).slice(2);
    setItems(a => [...a, { id, msg, kind }]);
    setTimeout(() => setItems(a => a.filter(x => x.id !== id)), 2600);
  }; setTick(t => t+1); }, []);
  return { items, push: (m,k) => push && push(m,k) };
}

export function ToastHost({ items }) {
  return React.createElement('div', { className:'toasts' },
    ...items.map(t =>
      React.createElement('div', { key:t.id, className:`toast ${t.kind}` }, t.msg)
    )
  );
}
