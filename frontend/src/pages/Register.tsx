import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../api/client";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { AxiosError } from "axios";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    full_name: "",
    platform: "zomato",
    platform_driver_id: "",
    h3_home_cell: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await apiClient.post("/auth/register", formData);
      navigate("/login");
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          setError(err.response.data.detail[0].msg || "Validation error");
        } else {
          setError(err.response.data.detail);
        }
      } else {
        setError("Registration failed.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neoBg py-12 px-4">
      <Card className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-neoSecondary">BECOME A MEMBER</h1>
          <p className="mt-2 font-bold">Driver Income Protection</p>
        </div>

        {error && (
          <div className="bg-neoPrimary text-white font-bold p-3 mb-4 border-3 border-black shadow-[2px_2px_0_0_#000]">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <Input label="Email" type="email" name="email" value={formData.email} onChange={handleChange} required />
          <Input label="Phone" type="text" name="phone" value={formData.phone} onChange={handleChange} required />
          <Input label="Password" type="password" name="password" value={formData.password} onChange={handleChange} required />
          
          <Input label="Full Name (Optional)" type="text" name="full_name" value={formData.full_name} onChange={handleChange} />
          
          <div className="flex flex-col mb-4">
            <label className="font-bold text-sm uppercase mb-1">Platform</label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              className="px-4 py-2 border-3 border-black text-neoText focus:outline-none focus:ring-4 focus:ring-neoAccent transition-all shadow-[2px_2px_0_0_#000] bg-white appearance-none cursor-pointer"
            >
              <option value="zomato">Zomato</option>
              <option value="swiggy">Swiggy</option>
              <option value="blinkit">Blinkit</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input label="Driver ID (Optional)" type="text" name="platform_driver_id" value={formData.platform_driver_id} onChange={handleChange} />
          <Input label="Home Cell H3 (Optional)" type="text" name="h3_home_cell" value={formData.h3_home_cell} onChange={handleChange} />

          <Button type="submit" variant="secondary" fullWidth className="mt-6 text-white text-lg">
            REGISTER
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p>
            Already registered?{" "}
            <Link to="/login" className="text-neoPrimary font-bold hover:underline">
              LOGIN
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Register;
