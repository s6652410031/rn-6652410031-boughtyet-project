import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import { supabase } from "./supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setLoading(false);
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let msg = `Login failed: ${error.message}`;
      if (error.message.includes("Invalid login credentials")) {
        msg +=
          " — If you just signed up, check your email to confirm your account.";
      }
      setAlert({ type: "error", message: msg });
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setAlert({ type: "error", message: `Sign up failed: ${error.message}` });
    } else if (
      data.user &&
      data.user.identities &&
      data.user.identities.length === 0
    ) {
      setAlert({
        type: "error",
        message: "This email is already registered. Please log in instead.",
      });
    } else {
      setAlert({
        type: "success",
        message:
          "Sign up successful! Check your email for confirmation, or try logging in.",
      });
      setIsSignUp(false);
    }
    setLoading(false);
  };

  if (loading && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-green-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-center text-3xl font-bold text-gray-800">
            BoughtYet? 🛒
          </h1>
          <p className="mb-6 text-center text-gray-500">
            {isSignUp ? "Create a family account" : "Family Grocery Login"}
          </p>

          {alert && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 flex items-start justify-between ${
                alert.type === "error"
                  ? "bg-red-100 text-red-800 border-red-300"
                  : "bg-green-100 text-green-800 border-green-300"
              }`}
            >
              <span className="text-sm font-medium">{alert.message}</span>
              <button
                onClick={() => setAlert(null)}
                className="ml-4 text-lg leading-none hover:opacity-70"
              >
                ×
              </button>
            </div>
          )}

          <form
            onSubmit={isSignUp ? handleSignUp : handleLogin}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setAlert(null);
                  }}
                  className="font-semibold text-green-600 hover:underline"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                No account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setAlert(null);
                  }}
                  className="font-semibold text-green-600 hover:underline"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
