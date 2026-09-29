import { useEffect, useState, useCallback } from "react";
import { fetchItems } from "./api.js";
import AddItemForm from "./components/AddItemForm.jsx";
import ItemsList from "./components/ItemsList.jsx";
import QueryPanel from "./components/QueryPanel.jsx";

export default function App() {
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState(null);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const res = await fetchItems();
      setItems(res.items);
    } catch (err) {
      setItemsError(err.message);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleItemAdded(newItem) {
    
    setItems((prev) => [
      {
        id: newItem.id,
        title: newItem.title,
        sourceType: newItem.sourceType,
        sourceUrl: newItem.sourceUrl,
        preview: "",
        contentLength: null,
        createdAt: newItem.createdAt,
      },
      ...prev,
    ]);
    loadItems();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>AI Knowledge Inbox</h1>
        <p className="muted">Save notes and links, then ask questions over them.</p>
      </header>

      <main className="app-main">
        <section className="column">
          <AddItemForm onItemAdded={handleItemAdded} />
          <ItemsList items={items} loading={itemsLoading} error={itemsError} />
        </section>

        <section className="column">
          <QueryPanel />
        </section>
      </main>
    </div>
  );
}
