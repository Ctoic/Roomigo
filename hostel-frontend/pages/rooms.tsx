import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { apiClient, buildApiUrl } from '@/lib/api';
import { useRouter } from 'next/router';

interface Room {
  id: number;
  room_number: number;
  capacity: number;
  current_occupancy: number;
  students: {
    id: number;
    name: string;
    picture: string;
  }[];
}

interface RoomsResponse {
  error?: string;
  message?: string;
  rooms?: Room[];
}

export default function Rooms() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRooms();
    }
  }, [isAuthenticated]);

  const fetchRooms = async () => {
    setIsLoading(true);
      setError(null);
    try {
      const { data } = await apiClient.get<RoomsResponse>('/api/rooms');

      if (data?.error) {
        throw new Error(data.error);
      }
      
      let roomsData = data?.rooms || [];
      
      if (!Array.isArray(roomsData)) {
        console.error('Rooms data is not an array:', roomsData);
        setError('Invalid data format received from server');
        setRooms([]);
        return;
      }

      // Ensure we have the expected number of rooms
      if (roomsData.length !== 18) {
        console.warn(`Expected 18 rooms, but got ${roomsData.length}. This might indicate a backend issue.`);
      }
      
      setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Failed to fetch rooms from server');
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  };



  const getRoomCapacityLabel = (capacity: number) => {
    return capacity === 3 ? '3-Seater' : '4-Seater';
  };

  const getRoomCapacityColor = (capacity: number) => {
    return capacity === 3 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  const getStudentImage = (picture?: string) => {
    if (!picture) {
      return '/default-avatar.png';
    }
    return buildApiUrl(`/static/uploads/${picture}`);
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Rooms</h1>
          <div className="text-sm text-gray-600">
            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">3-Seater Rooms: 14</span>
            <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded-full">4-Seater Rooms: 4</span>
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms && rooms.length > 0 ? (
            rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        Room {room.room_number}
                      </h3>
                      <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${getRoomCapacityColor(room.capacity)}`}>
                        {getRoomCapacityLabel(room.capacity)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        room.current_occupancy === room.capacity
                          ? 'bg-red-100 text-red-800'
                          : room.current_occupancy > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {room.current_occupancy}/{room.capacity} Occupied
                    </span>
                  </div>

                  {/* Occupants List */}
                  <div className="space-y-4">
                    {room.students && room.students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center space-x-3"
                      >
                        <div className="flex-shrink-0">
                          <img
                            className="h-8 w-8 rounded-full"
                            src={getStudentImage(student.picture)}
                            alt={student.name || 'Student'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {student.name || 'Unnamed Student'}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Empty Slots */}
                    {Array.from({ length: room.capacity - (room.students?.length || 0) }).map(
                      (_, index) => (
                        <div
                          key={`empty-${index}`}
                          className="flex items-center space-x-3"
                        >
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-500 truncate">
                              Empty Slot
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-gray-500">
              No rooms found
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 
