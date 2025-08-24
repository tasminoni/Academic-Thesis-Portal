import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToaster } from '../Toaster';

const SeatRequestPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToaster();
  const [seatInfo, setSeatInfo] = useState(null);
  const [seatRequestForm, setSeatRequestForm] = useState({
    requestedSeats: '',
    reason: ''
  });

  useEffect(() => {
    fetchSeatInfo();
  }, []);

  const fetchSeatInfo = async () => {
    try {
      const res = await axios.get('/api/auth/seat-info', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSeatInfo(res.data);
    } catch (err) {
      console.error('Error fetching seat info:', err);
    }
  };

  const handleSeatRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/seat-increase/request', seatRequestForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showSuccess('Seat increase request submitted successfully!');
      navigate('/faculty-dashboard');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to submit seat increase request');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-4">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Request Seat Increase</h2>
          </div>

          {seatInfo && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Current Seat Status</h3>
              <div className="text-sm text-gray-600">
                <p>Current Students: {seatInfo.currentStudents}/{seatInfo.seatCapacity}</p>
                <p className={`mt-1 ${seatInfo.availableSeats > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {seatInfo.availableSeats > 0 ? `${seatInfo.availableSeats} seats available` : 'No seats available'}
                </p>
                {seatInfo.hasPendingRequest && (
                  <p className="mt-1 text-yellow-600">Seat request pending</p>
                )}
              </div>
            </div>
          )}
          
          <form onSubmit={handleSeatRequest} className="space-y-4">
            <div>
              <label htmlFor="requestedSeats" className="block text-sm font-medium text-gray-700 mb-2">
                Number of Additional Seats
              </label>
              <input
                type="number"
                id="requestedSeats"
                min="1"
                max="10"
                required
                value={seatRequestForm.requestedSeats}
                onChange={(e) => setSeatRequestForm({...seatRequestForm, requestedSeats: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter number of seats (1-10)"
              />
            </div>
            
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Request
              </label>
              <textarea
                id="reason"
                required
                rows="4"
                value={seatRequestForm.reason}
                onChange={(e) => setSeatRequestForm({...seatRequestForm, reason: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Please explain why you need additional seats..."
              />
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SeatRequestPage; 