import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface RegistrationFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  emergency_contact: string;
  emergency_contact_name: string;
  university: string;
  course: string;
  year_of_study: string;
  expected_duration: string;
  special_requirements: string;
}

interface FormSubmissionState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  message: string;
}

export default function HostelRegistrationForm() {
  const [formData, setFormData] = useState<RegistrationFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_contact_name: '',
    university: '',
    course: '',
    year_of_study: '',
    expected_duration: '',
    special_requirements: ''
  });

  const [submissionState, setSubmissionState] = useState<FormSubmissionState>({
    status: 'idle',
    message: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionState({ status: 'submitting', message: '' });

    try {
      const response = await apiFetch('/api/registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setSubmissionState({
          status: 'success',
          message: result.message
        });
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          emergency_contact: '',
          emergency_contact_name: '',
          university: '',
          course: '',
          year_of_study: '',
          expected_duration: '',
          special_requirements: ''
        });
      } else {
        setSubmissionState({
          status: 'error',
          message: result.message || 'Failed to submit registration. Please try again.'
        });
      }
    } catch (error) {
      console.error('Registration submission error:', error);
      setSubmissionState({
        status: 'error',
        message: 'Failed to submit registration. Please check your connection and try again.'
      });
    }
  };

  const isFormValid = () => {
    const requiredFields = ['name', 'email', 'phone', 'address', 'emergency_contact', 'emergency_contact_name', 'university', 'course', 'year_of_study', 'expected_duration'];
    return requiredFields.every(field => formData[field as keyof RegistrationFormData].trim() !== '');
  };

  if (submissionState.status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto"
      >
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Registration Submitted Successfully!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {submissionState.message}
            </p>
            <Button 
              onClick={() => setSubmissionState({ status: 'idle', message: '' })}
              variant="outline"
            >
              Submit Another Registration
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center">Hostel Registration Form</CardTitle>
          <CardDescription className="text-center">
            Fill out this form to apply for hostel accommodation. We'll review your application and contact you soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Emergency Contact Number *</Label>
                  <Input
                    id="emergency_contact"
                    name="emergency_contact"
                    type="tel"
                    value={formData.emergency_contact}
                    onChange={handleInputChange}
                    placeholder="Emergency contact phone"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency_contact_name">Emergency Contact Name *</Label>
                <Input
                  id="emergency_contact_name"
                  name="emergency_contact_name"
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={handleInputChange}
                  placeholder="Name of emergency contact person"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Current Address *</Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Enter your current address"
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">
                Academic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="university">University/College *</Label>
                  <Input
                    id="university"
                    name="university"
                    type="text"
                    value={formData.university}
                    onChange={handleInputChange}
                    placeholder="Name of your university"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course">Course/Program *</Label>
                  <Input
                    id="course"
                    name="course"
                    type="text"
                    value={formData.course}
                    onChange={handleInputChange}
                    placeholder="Your course or program"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year_of_study">Year of Study *</Label>
                  <Input
                    id="year_of_study"
                    name="year_of_study"
                    type="text"
                    value={formData.year_of_study}
                    onChange={handleInputChange}
                    placeholder="e.g., 1st Year, 2nd Year, etc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected_duration">Expected Duration *</Label>
                  <Input
                    id="expected_duration"
                    name="expected_duration"
                    type="text"
                    value={formData.expected_duration}
                    onChange={handleInputChange}
                    placeholder="e.g., 1 year, 2 years, etc."
                    required
                  />
                </div>
              </div>
            </div>

            {/* Special Requirements */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">
                Additional Information
              </h3>
              <div className="space-y-2">
                <Label htmlFor="special_requirements">Special Requirements (Optional)</Label>
                <Textarea
                  id="special_requirements"
                  name="special_requirements"
                  value={formData.special_requirements}
                  onChange={handleInputChange}
                  placeholder="Any special requirements, dietary restrictions, accessibility needs, etc."
                  rows={4}
                />
              </div>
            </div>

            {/* Error Message */}
            {submissionState.status === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
              >
                <AlertCircle className="h-5 w-5" />
                <span>{submissionState.message}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <div className="flex justify-center pt-4">
              <Button
                type="submit"
                disabled={!isFormValid() || submissionState.status === 'submitting'}
                className="w-full md:w-auto px-8 py-3"
              >
                {submissionState.status === 'submitting' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Registration'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
