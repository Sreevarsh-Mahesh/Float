import React, { useState, useEffect } from "react";
import apiClient from "../../api/client";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inferenceFeedback, setInferenceFeedback] = useState("");

  const fetchData = async () => {
    try {
      const [statsRes, claimsRes, usersRes] = await Promise.all([
        apiClient.get("/admin/stats"),
        apiClient.get("/admin/claims?limit=20"),
        apiClient.get("/admin/users?limit=20"),
      ]);
      setStats(statsRes.data);
      setClaims(claimsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerBatchSimulate = async () => {
    setInferenceFeedback("Simulating weather triggers...");
    try {
      const res = await apiClient.post("/inference/batch-simulate?num_cells=10");
      setInferenceFeedback(`Triggered ${res.data.predictions.length} inferences in batch. Reloading stats...`);
      fetchData();
      setTimeout(() => setInferenceFeedback(""), 5000);
    } catch (err) {
      console.error(err);
      setInferenceFeedback("Simulation failed.");
    }
  };

  const dispatchPending = async () => {
    setInferenceFeedback("Dispatching payouts...");
    try {
      await apiClient.post("/admin/payouts/dispatch-pending");
      setInferenceFeedback("Payouts dispatched!");
      fetchData();
      setTimeout(() => setInferenceFeedback(""), 5000);
    } catch (err) {
      console.error(err);
      setInferenceFeedback("Dispatch failed.");
    }
  };

  const approveClaim = async (id: number) => {
    if (!window.confirm(`Approve claim #${id}?`)) return;
    try {
      await apiClient.patch(`/admin/claims/${id}`, { status: "manual_approved", review_notes: "Approved by admin" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const rejectClaim = async (id: number) => {
    if (!window.confirm(`Reject claim #${id}?`)) return;
    try {
      await apiClient.patch(`/admin/claims/${id}`, { status: "rejected", review_notes: "Rejected by admin" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 font-black uppercase text-2xl">Loading Admin...</div>;

  return (
    <div className="min-h-screen bg-neoBg p-4 md:p-8">
      <nav className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
        <div>
          <h1 className="text-4xl text-black tracking-tighter">ADMIN COMMAND CENTER</h1>
          <p className="font-bold text-neoPrimary mt-1">RESTRICTED ACCESS</p>
        </div>
        <div className="flex gap-4">
          <Button variant="accent" onClick={triggerBatchSimulate}>RUN SIMULATION</Button>
          <Button variant="primary" onClick={dispatchPending}>DISPATCH PAYOUTS</Button>
        </div>
      </nav>

      {inferenceFeedback && (
        <div className="bg-black text-white p-4 font-bold uppercase mb-8 shadow-neo border-3 border-white animate-pulse">
          {inferenceFeedback}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats ? Object.entries(stats).map(([k, v]) => (
          <Card key={k} className="bg-neoAccent border-4">
            <h3 className="text-xl uppercase tracking-widest mb-2 border-b-2 border-black pb-2">{k.replace(/_/g, " ")}</h3>
            <p className="text-5xl font-black">{String(v)}</p>
          </Card>
        )) : <p>No stats available.</p>}
      </div>

      {/* Claims Management */}
      <h2 className="text-3xl mb-6 bg-neoPrimary text-white inline-block px-4 py-2 border-3 border-black shadow-neo">RECENT CLAIMS</h2>
      <Card className="mb-12 border-4 p-0 overflow-hidden">
        <table className="w-full text-left font-sans">
          <thead className="bg-gray-100 border-b-4 border-black">
            <tr>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">ID</th>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">Driver</th>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">Status</th>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">Fraud Score</th>
              <th className="p-4 uppercase font-black text-lg">Action</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b-4 border-black last:border-b-0 hover:bg-gray-50">
                <td className="p-4 font-bold border-r-4 border-black text-neoSecondary tracking-wider">#{c.id}</td>
                <td className="p-4 font-bold border-r-4 border-black">DRIVER-{c.driver_id}</td>
                <td className="p-4 font-bold uppercase border-r-4 border-black">
                  <span className={`px-3 py-1 border-2 border-black ${
                    c.status.includes('approved') ? 'bg-neoGreen text-black' :
                    c.status.includes('rejected') ? 'bg-neoPrimary text-white' :
                    c.status.includes('review') ? 'bg-neoAccent text-black' : 'bg-gray-200 text-black'
                  }`}>{c.status.replace("_", " ")}</span>
                </td>
                <td className={`p-4 font-bold border-r-4 border-black text-xl ${c.fraud_score > 0.7 ? 'text-neoPrimary' : 'text-black'}`}>
                  {c.fraud_score?.toFixed(2) || "0.00"}
                </td>
                <td className="p-4 space-x-2">
                  {c.status.includes("review") || c.status.includes("pending") ? (
                    <>
                      <Button variant="secondary" className="px-2 py-1 text-sm shadow-[2px_2px_0_0_#000]" onClick={() => approveClaim(c.id)}>APPROVE</Button>
                      <Button variant="primary" className="px-2 py-1 text-sm shadow-[2px_2px_0_0_#000]" onClick={() => rejectClaim(c.id)}>REJECT</Button>
                    </>
                  ) : <span className="text-gray-400 italic font-bold">LOCKED</span>}
                </td>
              </tr>
            ))}
            {claims.length === 0 && <tr><td colSpan={5} className="p-4 font-bold text-center">No claims found.</td></tr>}
          </tbody>
        </table>
      </Card>

      {/* Users Admin */}
      <h2 className="text-3xl mb-6 bg-neoSecondary text-white inline-block px-4 py-2 border-3 border-black shadow-neo">REGISTERED USERS</h2>
      <Card className="border-4 p-0 overflow-hidden">
        <table className="w-full text-left font-sans">
          <thead className="bg-gray-100 border-b-4 border-black">
            <tr>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">ID</th>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">Email</th>
              <th className="p-4 uppercase font-black text-lg border-r-4 border-black">Platform</th>
              <th className="p-4 uppercase font-black text-lg">Roles</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b-4 border-black last:border-b-0 hover:bg-gray-50">
                <td className="p-4 font-bold border-r-4 border-black">#{u.id}</td>
                <td className="p-4 font-bold border-r-4 border-black">{u.email}</td>
                <td className="p-4 font-bold uppercase border-r-4 border-black text-neoPrimary">{u.platform}</td>
                <td className="p-4 font-bold">
                  {u.roles.map((r: string) => (
                    <span key={r} className="bg-black text-white px-2 py-1 uppercase text-xs mr-2">{r}</span>
                  ))}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="p-4 font-bold text-center">No users found.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default AdminDashboard;
