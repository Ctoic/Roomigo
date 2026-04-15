import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/router';

interface Employee {
  id: number;
  name: string;
  position: string;
  base_salary: number;
  hire_date: string;
  status: string;
  current_month_salary_paid: number;
  current_month_salary_status: string;
}

interface SalaryRecord {
  id: number;
  month_year: string;
  amount_paid: number;
  date_paid: string;
  payment_method: string;
  notes: string;
}

export default function Employees() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showSalaryHistory, setShowSalaryHistory] = useState(false);

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    position: '',
    base_salary: ''
  });

  const [newSalary, setNewSalary] = useState({
    month_year: '',
    amount_paid: '',
    payment_method: 'cash',
    notes: ''
  });

  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployees();
      fetchAvailableMonths();
    }
  }, [isAuthenticated]);

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get('/api/employees');
      const data = response.data as { success: boolean; employees: Employee[] };
      if (data.success) {
        setEmployees(data.employees);
        setFilteredEmployees(data.employees);
        setError(null);
      } else {
        setError('Failed to fetch employees');
      }
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      setError(error.response?.data?.message || 'Failed to fetch employees');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSalaryRecords = async (employeeId: number) => {
    try {
      const response = await apiClient.get(`/api/employees/${employeeId}/salaries`);
      const data = response.data as { success: boolean; salary_records: SalaryRecord[] };
      if (data.success) {
        setSalaryRecords(data.salary_records);
      } else {
        setError('Failed to fetch salary records');
      }
    } catch (error: any) {
      console.error('Error fetching salary records:', error);
      setError(error.response?.data?.message || 'Failed to fetch salary records');
    }
  };

  const fetchAvailableMonths = async () => {
    try {
      const response = await apiClient.get('/api/salaries/available-months');
      const data = response.data as { success: boolean; available_months: string[]; available_years: string[] };
      if (data.success) {
        setAvailableMonths(data.available_months);
        setAvailableYears(data.available_years);
      }
    } catch (error: any) {
      console.error('Error fetching available months:', error);
    }
  };

  const handleMonthFilter = (monthYear: string) => {
    setSelectedMonth(monthYear);
    setSelectedYear('');
    
    if (!monthYear) {
      setFilteredEmployees(employees);
      return;
    }
    
    // Filter employees based on selected month
    const filtered = employees.filter(emp => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      return monthYear === currentMonth;
    });
    setFilteredEmployees(filtered);
  };

  const handleYearFilter = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth('');
    
    if (!year) {
      setFilteredEmployees(employees);
      return;
    }
    
    // Filter employees based on selected year
    const filtered = employees.filter(emp => {
      const currentYear = new Date().getFullYear().toString();
      return year === currentYear;
    });
    setFilteredEmployees(filtered);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiClient.post('/api/employees', newEmployee);
      const data = response.data as { success: boolean; message: string; employee_id?: number };
      
      if (data.success) {
        setShowAddEmployee(false);
        setNewEmployee({ name: '', position: '', base_salary: '' });
        fetchEmployees();
      } else {
        setError(data.message || 'Failed to add employee');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to add employee');
    }
  };

  const handleAddSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    try {
      const response = await apiClient.post(`/api/employees/${selectedEmployee.id}/salaries`, newSalary);
      const data = response.data as { success: boolean; message: string };
      
      if (data.success) {
        setShowAddSalary(false);
        setNewSalary({ month_year: '', amount_paid: '', payment_method: 'cash', notes: '' });
        fetchEmployees();
        fetchAvailableMonths();
        if (showSalaryHistory) {
          fetchSalaryRecords(selectedEmployee.id);
        }
      } else {
        setError(data.message || 'Failed to add salary payment');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to add salary payment');
    }
  };

  const handleDeleteEmployee = async (employeeId: number) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      const response = await apiClient.delete(`/api/employees/${employeeId}`);
      const data = response.data as { success: boolean; message: string };
      
      if (data.success) {
        fetchEmployees();
      } else {
        setError(data.message || 'Failed to delete employee');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete employee');
    }
  };

  const handleDeleteSalary = async (salaryId: number) => {
    if (!confirm('Are you sure you want to delete this salary record?')) return;

    try {
      const response = await apiClient.delete(`/api/salaries/${salaryId}`);
      const data = response.data as { success: boolean; message: string };
      
      if (data.success) {
        if (selectedEmployee) {
          fetchSalaryRecords(selectedEmployee.id);
        }
        fetchAvailableMonths();
      } else {
        setError(data.message || 'Failed to delete salary record');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete salary record');
    }
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-red-600 text-lg">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Employee Management</h1>
          <button
            onClick={() => setShowAddEmployee(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            Add Employee
          </button>
        </div>

        {/* Month/Year Filter and Salary Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Salary Overview & Filtering</h2>
              <div className="flex space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Month</label>
                  <select 
                    className="border border-border bg-surface text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    value={selectedMonth}
                    onChange={(e) => handleMonthFilter(e.target.value)}
                  >
                    <option value="">All Months</option>
                    {availableMonths.map((month) => {
                      const [year, monthNum] = month.split('-');
                      const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                      return (
                        <option key={month} value={month}>
                          {date.toLocaleString('default', { month: 'long' })} {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Year</label>
                  <select 
                    className="border border-border bg-surface text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    value={selectedYear}
                    onChange={(e) => handleYearFilter(e.target.value)}
                  >
                    <option value="">All Years</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setSelectedMonth('');
                      setSelectedYear('');
                      setFilteredEmployees(employees);
                    }}
                    className="mt-6 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Current Month Total</div>
              <div className="text-2xl font-bold text-blue-600">
                Rs. {employees.reduce((sum, emp) => sum + emp.current_month_salary_paid, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                {employees.filter(emp => emp.current_month_salary_status === 'paid').length} of {employees.length} employees paid
              </div>
              {selectedMonth && (
                <div className="text-sm text-gray-500 mt-2">
                  Filtered: {selectedMonth}
                </div>
              )}
              {selectedYear && (
                <div className="text-sm text-gray-500 mt-2">
                  Filtered: {selectedYear}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Salary Summary Table */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Monthly Salary Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-blue-800 font-medium text-sm">Total Employees</h4>
                <p className="text-2xl font-bold text-blue-600">{employees.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="text-green-800 font-medium text-sm">Paid This Month</h4>
                <p className="text-2xl font-bold text-green-600">
                  {employees.filter(emp => emp.current_month_salary_status === 'paid').length}
                </p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="text-yellow-800 font-medium text-sm">Unpaid This Month</h4>
                <p className="text-2xl font-bold text-yellow-600">
                  {employees.filter(emp => emp.current_month_salary_status === 'unpaid').length}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="text-purple-800 font-medium text-sm">Total Salaries</h4>
                <p className="text-2xl font-bold text-purple-600">
                  Rs. {employees.reduce((sum, emp) => sum + emp.current_month_salary_paid, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Employees</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Salary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hire Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Month Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.position}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">Rs. {employee.base_salary.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{employee.hire_date}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.current_month_salary_status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.current_month_salary_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowSalaryHistory(true);
                          fetchSalaryRecords(employee.id);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Salaries
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowAddSalary(true);
                          setNewSalary({ ...newSalary, month_year: getCurrentMonthYear() });
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        Pay Salary
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Employee Modal */}
        {showAddEmployee && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Employee</h3>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      required
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Position</label>
                    <input
                      type="text"
                      required
                      value={newEmployee.position}
                      onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Base Salary</label>
                    <input
                      type="number"
                      required
                      value={newEmployee.base_salary}
                      onChange={(e) => setNewEmployee({ ...newEmployee, base_salary: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
                    >
                      Add Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddEmployee(false)}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add Salary Modal */}
        {showAddSalary && selectedEmployee && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Pay Salary - {selectedEmployee.name}
                </h3>
                <form onSubmit={handleAddSalary} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Month-Year</label>
                    <input
                      type="month"
                      required
                      value={newSalary.month_year}
                      onChange={(e) => setNewSalary({ ...newSalary, month_year: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Amount Paid</label>
                    <input
                      type="number"
                      required
                      value={newSalary.amount_paid}
                      onChange={(e) => setNewSalary({ ...newSalary, amount_paid: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                    <select
                      value={newSalary.payment_method}
                      onChange={(e) => setNewSalary({ ...newSalary, payment_method: e.target.value })}
                      className="mt-1 block w-full border border-border bg-surface text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="check">Check</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      value={newSalary.notes}
                      onChange={(e) => setNewSalary({ ...newSalary, notes: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={3}
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                    >
                      Record Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddSalary(false)}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Salary History Modal */}
        {showSalaryHistory && selectedEmployee && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Salary History - {selectedEmployee.name}
                  </h3>
                  <button
                    onClick={() => setShowSalaryHistory(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Month-Year
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount Paid
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date Paid
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Notes
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salaryRecords.map((record) => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.month_year}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Rs. {record.amount_paid.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.date_paid}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.payment_method}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {record.notes || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteSalary(record.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {salaryRecords.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                            No salary records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
