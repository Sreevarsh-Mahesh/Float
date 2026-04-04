import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [policy, setPolicy] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policyRes, tiersRes, claimsRes, payoutsRes] = await Promise.all([
          apiClient.get("/policies/me"),
          apiClient.get("/policies/tiers"),
          apiClient.get("/claims/me?limit=5"),
          apiClient.get("/claims/me/payouts?limit=5"),
        ]);
        setPolicy(policyRes.data);
        setTiers(tiersRes.data);
        setClaims(claimsRes.data);
        setPayouts(payoutsRes.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const subscribe = async (tier: string) => {
    if (!window.confirm(`Are you sure you want to subscribe to the ${tier.toUpperCase()} tier?`)) return;
    try {
      const res = await apiClient.post("/policies/subscribe", { tier });
      setPolicy(res.data);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Subscription failed.");
    }
  };

  const cancelPolicy = async (id: number) => {
    if (!window.confirm("Cancel your active policy?")) return;
    try {
      await apiClient.delete(`/policies/${id}`);
      setPolicy(null);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Cancellation failed.");
    }
  };

  if (loading) return <div className="p-8 font-black uppercase text-2xl">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-neoBg p-4 md:p-8">
      <nav className="flex justify-between border-b-3 border-black pb-4 mb-8 items-center">
        <h1 className="text-3xl text-neoPrimary tracking-tighter">FLOAT_</h1>
        <div className="flex space-x-4 items-center">
          {(user?.roles?.includes("admin") || user?.roles?.includes("reviewer")) && (
            <Link to="/admin" className="font-bold underline text-neoSecondary uppercase">
              Admin Portal
            </Link>
          )}
          <span className="font-bold hidden md:inline">{user?.email}</span>
          <Button variant="dark" onClick={logout}>LOGOUT</Button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile & Status */}
        <div className="space-y-8 lg:col-span-1">
          <Card className="bg-neoAccent">
            <h2 className="text-2xl mb-4 text-black">YOUR PROFILE</h2>
            <div className="space-y-2">
              <p><strong>NAME:</strong> {user?.full_name || "N/A"}</p>
              <p><strong>PHONE:</strong> {user?.phone}</p>
              <p><strong>PLATFORM:</strong> <span className="uppercase">{user?.platform}</span></p>
              <p><strong>HOME CELL:</strong> {user?.h3_home_cell || "NOT SET"}</p>
            </div>
            {/* Update location button omitted for brevity but could be added later */}
          </Card>

          <Card>
            <h2 className="text-2xl mb-4" style={{ color: policy ? 'green' : 'red' }}>
              {policy ? "ACTIVE POLICY" : "NO COVERAGE"}
            </h2>
            {policy ? (
              <div className="space-y-3">
                <p className="text-4xl font-black text-neoSecondary">{policy.tier}</p>
                <div className="border-t-3 border-black pt-2">
                  <p><strong>PREMIUM:</strong> ₹{policy.weekly_premium}/week</p>
                  <p><strong>COVERAGE:</strong> {policy.coverage_pct * 100}% of lost income</p>
                  <p><strong>ACTIVATED:</strong> {new Date(policy.activated_at).toLocaleDateString()}</p>
                </div>
                <Button variant="primary" fullWidth className="mt-4 text-black" onClick={() => cancelPolicy(policy.id)}>
                  CANCEL POLICY
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-medium">You are unprotected against local disruptions. Select a tier below.</p>
                {tiers.map((t) => (
                  <div key={t.tier} className="border-3 border-black p-4 bg-gray-50 flex flex-col hover:-translate-y-1 transition-transform">
                    <h3 className="text-xl text-neoSecondary">{t.label}</h3>
                    <div className="font-bold text-xl my-2">₹{t.weekly_premium}/wk</div>
                    <Button variant="accent" onClick={() => subscribe(t.tier)}>
                      SUBSCRIBE
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Content */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <h2 className="text-2xl mb-4 border-b-3 border-black pb-2">RECENT CLAIMS</h2>
            {claims.length === 0 ? (
              <p className="italic">No claims filed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans font-medium">
                  <thead>
                    <tr className="border-b-3 border-black">
                      <th className="p-3 uppercase">ID</th>
                      <th className="p-3 uppercase">Status</th>
                      <th className="p-3 uppercase">Estimate</th>
                      <th className="p-3 uppercase">Filed On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((c) => (
                      <tr key={c.id} className="border-b border-gray-300">
                        <td className="p-3 font-bold">#{c.id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 border-2 border-black font-bold uppercase tracking-wider text-xs ${
                            c.status === "payout_dispatched" ? "bg-neoGreen" : 
                            c.status === "rejected" ? "bg-neoPrimary text-white" : "bg-neoAccent"
                          }`}>
                            {c.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3">₹{c.payout_estimate}</td>
                        <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-2xl mb-4 border-b-3 border-black pb-2">PAYOUT HISTORY</h2>
            {payouts.length === 0 ? (
              <p className="italic">No payouts yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans font-medium">
                  <thead>
                    <tr className="border-b-3 border-black">
                      <th className="p-3 uppercase">Ref</th>
                      <th className="p-3 uppercase">Amount</th>
                      <th className="p-3 uppercase">Status</th>
                      <th className="p-3 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id} className="border-b border-gray-300 bg-green-50">
                        <td className="p-3 font-bold break-all max-w-[150px]">{p.transaction_ref || 'PENDING'}</td>
                        <td className="p-3 text-xl font-black text-neoSecondary">₹{p.final_amount}</td>
                        <td className="p-3 uppercase font-bold text-sm tracking-wide">{p.status}</td>
                        <td className="p-3">{p.disbursed_at ? new Date(p.disbursed_at).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
