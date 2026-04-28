import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Dashboard Component - Grouped by Item Name                         */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  /* ---------- Session ---------- */
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ---------- Data ---------- */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ---------- Add Item Form ---------- */
  const [newItemName, setNewItemName] = useState("");
  const [listType, setListType] = useState("weekly");

  /* ---------- Buy Inline Input ---------- */
  const [buyingGroupKey, setBuyingGroupKey] = useState(null);
  const [buyPrice, setBuyPrice] = useState("");

  /* ---------------------------------------------------------------- */
  /*  Auth Check                                                      */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setAuthLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Fetch Items + Purchase History                                  */
  /* ---------------------------------------------------------------- */

  const fetchItems = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("items")
      .select("*, purchase_history(price, purchased_at)")
      .order("created_at", { ascending: false });

    if (error) {
      setError(`Failed to fetch items: ${error.message}`);
      setLoading(false);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) fetchItems();
  }, [session, fetchItems]);

  /* ---------------------------------------------------------------- */
  /*  Group items by name + list_type                                 */
  /* ---------------------------------------------------------------- */

  const groupedItems = items.reduce((acc, item) => {
    const key = `${item.name}|${item.list_type}`;
    if (!acc[key]) {
      acc[key] = {
        name: item.name,
        list_type: item.list_type,
        items: [],
        purchase_history: [],
      };
    }
    acc[key].items.push(item);
    if (item.purchase_history) {
      acc[key].purchase_history.push(...item.purchase_history);
    }
    return acc;
  }, {});

  // Sort purchase_history newest → oldest for each group
  Object.values(groupedItems).forEach((group) => {
    group.purchase_history.sort(
      (a, b) =>
        new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime(),
    );
  });

  /* ---------------------------------------------------------------- */
  /*  Add New Item                                                    */
  /* ---------------------------------------------------------------- */

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from("items")
      .insert([{ name: newItemName.trim(), list_type: listType }]);

    if (error) {
      setError(`Failed to add item: ${error.message}`);
    } else {
      setNewItemName("");
      setListType("weekly");
      await fetchItems();
    }
    setLoading(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Mark as Bought (Update + Insert)                                */
  /* ---------------------------------------------------------------- */

  const startBuy = (groupKey) => {
    setBuyingGroupKey(groupKey);
    setBuyPrice("");
  };

  const cancelBuy = () => {
    setBuyingGroupKey(null);
    setBuyPrice("");
  };

  const submitBuy = async (group) => {
    const price = Number(buyPrice);
    if (!buyPrice || isNaN(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    // Find the oldest pending item in this group
    const pendingItem = group.items
      .filter((i) => !i.is_bought)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];

    if (!pendingItem) {
      setError("No pending items to mark as bought.");
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Update item as bought
    const { error: updateError } = await supabase
      .from("items")
      .update({ is_bought: true })
      .eq("id", pendingItem.id);

    if (updateError) {
      setError(`Failed to update item: ${updateError.message}`);
      setLoading(false);
      return;
    }

    // 2. Insert purchase history
    const { error: insertError } = await supabase
      .from("purchase_history")
      .insert([{ item_id: pendingItem.id, price }]);

    if (insertError) {
      setError(`Failed to record purchase: ${insertError.message}`);
      setLoading(false);
      return;
    }

    setBuyingGroupKey(null);
    setBuyPrice("");
    await fetchItems();
    setLoading(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Delete Item                                                     */
  /* ---------------------------------------------------------------- */

  const handleDelete = async (id) => {
    setError(null);
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) {
      setError(`Failed to delete item: ${error.message}`);
    } else {
      await fetchItems();
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Price Comparison Sub-component                                  */
  /* ---------------------------------------------------------------- */

  function PriceComparison({ history }) {
    if (!history || history.length === 0) {
      return (
        <div className="flex items-center gap-1.5 text-sm text-gray-400 italic">
          <span>📭</span>
          <span>No purchase history yet</span>
        </div>
      );
    }

    if (history.length === 1) {
      return (
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <span>💰</span>
          <span>Current Price: ฿{history[0].price}</span>
        </div>
      );
    }

    const latest = history[0].price;
    const previous = history[1].price;
    const diff = latest - previous;

    if (diff > 0) {
      return (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-sm font-semibold text-red-600">
          <span>📈</span>
          <span>
            ฿{latest} (Increased by ฿{diff} 🔺)
          </span>
        </div>
      );
    }

    if (diff < 0) {
      return (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-sm font-semibold text-green-600">
          <span>📉</span>
          <span>
            ฿{latest} (Decreased by ฿{Math.abs(diff)} 🔻)
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-sm text-gray-700">
        <span>➖</span>
        <span>฿{latest} (No change)</span>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Price History List with Date/Time                               */
  /* ---------------------------------------------------------------- */

  function PriceHistoryList({ history }) {
    if (!history || history.length === 0) return null;

    return (
      <div className="mt-3 rounded-lg bg-gray-50 p-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">
          📊 Purchase History:
        </p>
        <div className="space-y-1.5">
          {history.map((h, idx) => {
            const date = new Date(h.purchased_at);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded bg-white border px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-gray-800">฿{h.price}</span>
                <span className="text-xs text-gray-400">
                  {dateStr} at {timeStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render Helpers                                                  */
  /* ---------------------------------------------------------------- */

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-green-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white p-8 shadow-lg text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Please Log In
          </h2>
          <p className="text-gray-500">
            You need to be signed in to view the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">BoughtYet? 🛒</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-800">
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 text-lg leading-none hover:opacity-70"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Add Item Form */}
        <div className="mb-6 rounded-xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">
            Add New Item
          </h2>
          <form
            onSubmit={handleAddItem}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Item Name
              </label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Milk, Eggs, Rice..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                List
              </label>
              <select
                value={listType}
                onChange={(e) => setListType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 sm:w-36"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white hover:bg-green-700 transition disabled:opacity-60"
            >
              {loading ? "Adding…" : "Add"}
            </button>
          </form>
        </div>

        {/* Items List */}
        {loading && Object.keys(groupedItems).length === 0 && (
          <div className="flex justify-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-green-600" />
          </div>
        )}

        <div className="space-y-4">
          {Object.keys(groupedItems).length === 0 && !loading && (
            <div className="rounded-xl bg-white py-12 text-center text-gray-400 shadow">
              No items yet. Add your first grocery item above! 🥦
            </div>
          )}

          {Object.values(groupedItems).map((group) => {
            const groupKey = `${group.name}|${group.list_type}`;
            const pendingCount = group.items.filter((i) => !i.is_bought).length;
            const boughtCount = group.items.filter((i) => i.is_bought).length;
            const isBuying = buyingGroupKey === groupKey;

            return (
              <div key={groupKey} className="rounded-xl bg-white p-5 shadow">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xl font-bold text-gray-800">
                        {group.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          group.list_type === "weekly"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {group.list_type}
                      </span>
                      {pendingCount > 0 && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          {pendingCount} pending
                        </span>
                      )}
                      {boughtCount > 0 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          {boughtCount} bought
                        </span>
                      )}
                    </div>

                    {/* Price Comparison */}
                    <div className="mt-2">
                      <PriceComparison history={group.purchase_history} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {pendingCount > 0 && !isBuying && (
                      <button
                        onClick={() => startBuy(groupKey)}
                        className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition"
                      >
                        Mark as Bought
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Buy Price Input */}
                {isBuying && (
                  <div className="mt-4 flex flex-col gap-2 rounded-lg bg-gray-50 p-4 sm:flex-row sm:items-center">
                    <label className="text-sm font-medium text-gray-700">
                      Price (฿):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitBuy(group)}
                        disabled={loading}
                        className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-60"
                      >
                        {loading ? "Saving…" : "Submit"}
                      </button>
                      <button
                        onClick={cancelBuy}
                        className="rounded-lg bg-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-400 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Price History with Date & Time */}
                <PriceHistoryList history={group.purchase_history} />

                {/* Individual Items in Group (for delete) */}
                {group.items.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-400 mb-2">
                      Individual entries:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <span
                          key={item.id}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                            item.is_bought
                              ? "bg-green-50 text-green-700"
                              : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {item.is_bought ? "✓" : "○"}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="ml-1 text-gray-400 hover:text-red-500"
                            title="Delete"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {group.items.length === 1 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-right">
                    <button
                      onClick={() => handleDelete(group.items[0].id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
