import React, { useState } from 'react'
import { useContext } from 'react';
import { AppContext } from '../context/AppContext.jsx';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {

  const { backendUrl, token, setToken } = useContext(AppContext);
  const navigate = useNavigate();

  const [state, setState] = useState('Login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    try {
      if (state === 'Sign Up') {
        const { data } = await axios.post(`${backendUrl}/api/user/register`, { name, password, username });
        if (data.success) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
        } else {
          toast.error(data.message);
        }
      } else {
        const { data } = await axios.post(`${backendUrl}/api/user/login`, { username, password });
        if (data.success) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
        } else {
          toast.error(data.message);
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (token) {
      navigate('/');
    }
  }, [token, navigate]);

  return (
    <form onSubmit={onSubmitHandler} className='min-h-[80vh] flex items-center justify-center bg-linear-to-br px-4'>
      <div className='flex flex-col gap-6 m-auto items-start p-10 min-w-85 sm:min-w-96 bg-white border border-gray-200 rounded-2xl text-zinc-600 text-sm shadow-2xl backdrop-blur-sm'>
        <div className='w-full text-center'>
          <p className='text-3xl font-bold text-gray-800 mb-2'>{state === 'Sign Up' ? 'Create Account' : 'Welcome Back'}</p>
          <p className='text-gray-500 capitalize'>please {state === 'Sign Up' ? 'sign up' : 'log in'} </p>
        </div>
        {
          state === 'Sign Up' && <div className='w-full'>
            <p className='text-gray-700 font-medium mb-2'>Full Name</p>
            <input
              className='border border-gray-300 rounded-lg w-full p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 placeholder-gray-400'
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        }

        <div className='w-full'>
          <p className='text-gray-700 font-medium mb-2'>Username</p>
          <input
            className='border border-gray-300 rounded-lg w-full p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 placeholder-gray-400'
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className='w-full'>
          <p className='text-gray-700 font-medium mb-2'>Password</p>
          <input
            className='border border-gray-300 rounded-lg w-full p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 placeholder-gray-400'
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type='submit' className='bg-blue-700 hover:bg-blue-600 text-white w-full py-3 rounded-lg text-base font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 mt-2'>
          {state === 'Sign Up' ? 'Create Account' : 'Login'}
        </button>

        <div className='w-full text-center'>
          {
            state === 'Sign Up'
              ? <p className='text-gray-600'>Already have an account? <span onClick={() => setState('Login')} className='text-blue-800 font-semibold hover:text-blue-700 cursor-pointer transition-colors duration-200'>Login here</span></p>
              : <p className='text-gray-600'>Create an account? <span onClick={() => setState('Sign Up')} className='text-blue-800 font-semibold hover:text-blue-700 cursor-pointer transition-colors duration-200'>Sign up here</span></p>
          }
        </div>
      </div>
    </form>
  )
}

export default Login