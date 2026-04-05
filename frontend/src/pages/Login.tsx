import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../api/client";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { AxiosError } from "axios";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);

      const res = await apiClient.post("/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      login(res.data.access_token, res.data.refresh_token);
      navigate("/dashboard");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Login failed. Check your credentials.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neoBg p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-neoPrimary">FLOAT</h1>
          <p className="mt-2 text-xl font-bold">Parametric Income Protection</p>
        </div>

        {error && (
          <div className="bg-neoPrimary text-white font-bold p-3 mb-4 border-3 border-black shadow-[2px_2px_0_0_#000]">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" fullWidth className="mt-4 text-black">
            LOGIN
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="text-neoSecondary font-bold hover:underline">
              REGISTER HERE
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Login;
