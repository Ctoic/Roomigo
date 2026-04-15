import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Phone, 
  Mail, 
  MapPin, 
  GraduationCap,
  Filter,
  Search,
  Eye,
  MessageSquare,
  Trash2,
  Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '@/lib/api';

interface Registration {
  id: number;
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
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  submitted_at: string;
  admin_notes: string;
  contacted_at: string | null;
  contacted_by: string | null;
}

interface RegistrationStats {
  total_registrations: number;
  pending_count: number;
  contacted_count: number;
  approved_count: number;
  rejected_count: number;
  recent_count: number;
}

export default function Registrations() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updating, setUpdating] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchRegistrations();
      fetchStats();
    }
  }, [user, loading, statusFilter, currentPage]);

  const fetchRegistrations = async () => {
    try {
      setLoadingData(true);
      const response = await apiFetch(`/api/admin/registrations?page=${currentPage}&status=${statusFilter}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch registrations');
      }

      setRegistrations(Array.isArray(data.registrations) ? data.registrations : []);
      setTotalPages(typeof data.meta?.total_pages === 'number' ? data.meta.total_pages : 1);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      setRegistrations([]);
      setTotalPages(1);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiFetch('/api/admin/registrations/stats');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch registration stats');
      }
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(null);
    }
  };

  const updateRegistrationStatus = async (id: number, status: string, notes?: string) => {
    try {
      setUpdating(id);
      const response = await apiFetch(`/api/admin/registrations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, admin_notes: notes }),
      });

      if (response.ok) {
        fetchRegistrations();
        fetchStats();
        setSelectedRegistration(null);
        setAdminNotes('');
      }
    } catch (error) {
      console.error('Error updating registration:', error);
    } finally {
      setUpdating(null);
    }
  };

  const deleteRegistration = async (id: number) => {
    if (!confirm('Are you sure you want to delete this registration?')) return;
    
    try {
      const response = await apiFetch(`/api/admin/registrations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchRegistrations();
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting registration:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      contacted: { color: 'bg-blue-100 text-blue-800', icon: Phone },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
    };
    
    const safeStatus = status in statusConfig ? status : 'pending';
    const config = statusConfig[safeStatus as keyof typeof statusConfig];
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
      </Badge>
    );
  };

  const filteredRegistrations = registrations.filter(reg =>
    (reg.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reg.email ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reg.university ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Registration Requests
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage student hostel registration applications
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.total_registrations}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.pending_count}</div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.contacted_count}</div>
                    <div className="text-sm text-gray-600">Contacted</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.approved_count}</div>
                    <div className="text-sm text-gray-600">Approved</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.rejected_count}</div>
                    <div className="text-sm text-gray-600">Rejected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold">{stats.recent_count}</div>
                    <div className="text-sm text-gray-600">This Week</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, or university..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-border bg-surface text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registrations List */}
        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRegistrations.map((registration) => (
              <motion.div
                key={registration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="transition-all duration-200"
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {registration.name}
                          </h3>
                          {getStatusBadge(registration.status)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {registration.email}
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {registration.phone}
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            {registration.university} - {registration.course}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {new Date(registration.submitted_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRegistration(registration)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {registration.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => updateRegistrationStatus(registration.id, 'contacted')}
                            disabled={updating === registration.id}
                          >
                            {updating === registration.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Phone className="h-4 w-4 mr-1" />
                                Contact
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteRegistration(registration.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 py-2 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Registration Detail Modal */}
        {selectedRegistration && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedRegistration.name}</CardTitle>
                      <CardDescription>
                        Submitted on {new Date(selectedRegistration.submitted_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRegistration(null)}
                    >
                      Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h4 className="font-semibold mb-3">Personal Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-600">Email</Label>
                        <p className="font-medium">{selectedRegistration.email}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Phone</Label>
                        <p className="font-medium">{selectedRegistration.phone}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Emergency Contact</Label>
                        <p className="font-medium">{selectedRegistration.emergency_contact_name}</p>
                        <p className="text-gray-600">{selectedRegistration.emergency_contact}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Address</Label>
                        <p className="font-medium">{selectedRegistration.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div>
                    <h4 className="font-semibold mb-3">Academic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-600">University</Label>
                        <p className="font-medium">{selectedRegistration.university}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Course</Label>
                        <p className="font-medium">{selectedRegistration.course}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Year of Study</Label>
                        <p className="font-medium">{selectedRegistration.year_of_study}</p>
                      </div>
                      <div>
                        <Label className="text-gray-600">Expected Duration</Label>
                        <p className="font-medium">{selectedRegistration.expected_duration}</p>
                      </div>
                    </div>
                  </div>

                  {/* Special Requirements */}
                  {selectedRegistration.special_requirements && (
                    <div>
                      <h4 className="font-semibold mb-3">Special Requirements</h4>
                      <p className="text-sm text-gray-600">{selectedRegistration.special_requirements}</p>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div>
                    <Label htmlFor="admin-notes">Admin Notes</Label>
                    <Textarea
                      id="admin-notes"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about this registration..."
                      rows={3}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 border-t">
                    {selectedRegistration.status === 'pending' && (
                      <>
                        <Button
                          onClick={() => updateRegistrationStatus(selectedRegistration.id, 'contacted', adminNotes)}
                          disabled={updating === selectedRegistration.id}
                        >
                          {updating === selectedRegistration.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Phone className="h-4 w-4 mr-2" />
                          )}
                          Mark as Contacted
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updateRegistrationStatus(selectedRegistration.id, 'approved', adminNotes)}
                          disabled={updating === selectedRegistration.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updateRegistrationStatus(selectedRegistration.id, 'rejected', adminNotes)}
                          disabled={updating === selectedRegistration.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
