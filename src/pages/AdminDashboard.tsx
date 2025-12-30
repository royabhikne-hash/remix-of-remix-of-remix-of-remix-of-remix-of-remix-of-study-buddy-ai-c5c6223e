import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Users,
  Building2,
  LogOut,
  Plus,
  Search,
  TrendingUp,
  Send,
  FileText,
  Loader2,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface School {
  id: string;
  school_id: string;
  name: string;
  district: string | null;
  state: string | null;
  studentCount: number;
}

interface Student {
  id: string;
  full_name: string;
  class: string;
  parent_whatsapp: string;
  school_name: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminName, setAdminName] = useState("Admin");
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"schools" | "students" | "reports">("schools");
  
  // Add school modal state
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [newSchool, setNewSchool] = useState({
    name: "",
    district: "",
    state: "Bihar",
  });
  const [addingSchool, setAddingSchool] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ id: string; password: string } | null>(null);

  // Send report state
  const [sendingReportFor, setSendingReportFor] = useState<string | null>(null);

  useEffect(() => {
    const storedAdminId = localStorage.getItem("adminId");
    const storedAdminName = localStorage.getItem("adminName");
    
    if (!storedAdminId) {
      navigate("/admin-login");
      return;
    }
    
    if (storedAdminName) {
      setAdminName(storedAdminName);
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      // Load schools with student counts
      const { data: schoolsData } = await supabase.from("schools").select("*");
      const { data: studentsData } = await supabase.from("students").select("*, schools(name)");

      if (schoolsData && studentsData) {
        const schoolsWithCounts = schoolsData.map((school) => ({
          ...school,
          studentCount: studentsData.filter((s) => s.school_id === school.id).length,
        }));
        setSchools(schoolsWithCounts);

        const formattedStudents = studentsData.map((s) => ({
          id: s.id,
          full_name: s.full_name,
          class: s.class,
          parent_whatsapp: s.parent_whatsapp,
          school_name: (s.schools as any)?.name || "No School",
        }));
        setStudents(formattedStudents);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateSchoolCredentials = (name: string) => {
    // Generate school ID from name
    const prefix = name
      .split(" ")
      .map((word) => word.charAt(0).toLowerCase())
      .join("")
      .slice(0, 3);
    const suffix = "855108";
    const schoolId = `${prefix}${suffix}`;
    const password = `${prefix}kne${suffix}`;
    return { id: schoolId, password };
  };

  const handleAddSchool = async () => {
    if (!newSchool.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter school name",
        variant: "destructive",
      });
      return;
    }

    setAddingSchool(true);
    const credentials = generateSchoolCredentials(newSchool.name);

    try {
      const { error } = await supabase.from("schools").insert({
        school_id: credentials.id,
        password_hash: credentials.password,
        name: newSchool.name,
        district: newSchool.district || null,
        state: newSchool.state || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "School Already Exists",
            description: "A school with similar credentials already exists.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        setGeneratedCredentials(credentials);
        toast({
          title: "School Added!",
          description: `${newSchool.name} has been added successfully.`,
        });
        loadData();
      }
    } catch (error) {
      console.error("Error adding school:", error);
      toast({
        title: "Error",
        description: "Failed to add school. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingSchool(false);
    }
  };

  const handleSendReport = async (studentId: string, parentWhatsapp: string) => {
    setSendingReportFor(studentId);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-report", {
        body: { studentId, testMode: true },
      });

      if (error) throw error;

      if (data?.success) {
        // Save report record
        await supabase.from("parent_reports").insert({
          student_id: studentId,
          report_type: "manual",
          report_data: data.reportData || {},
          sent_at: new Date().toISOString(),
          sent_to: parentWhatsapp,
          created_by: localStorage.getItem("adminId"),
          created_by_type: "admin",
        });

        toast({
          title: "Report Sent!",
          description: `WhatsApp report sent to ${parentWhatsapp}`,
        });
      } else {
        throw new Error(data?.error || "Failed to send report");
      }
    } catch (error) {
      console.error("Error sending report:", error);
      toast({
        title: "Failed to send report",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingReportFor(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const filteredSchools = schools.filter((school) =>
    school.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(
    (student) =>
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.school_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalStudents: students.length,
    totalSchools: schools.length,
    activeSchools: schools.filter((s) => s.studentCount > 0).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-destructive flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Shield className="w-6 h-6 text-destructive-foreground" />
          </div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive flex items-center justify-center">
                <Shield className="w-6 h-6 text-destructive-foreground" />
              </div>
              <div>
                <span className="font-bold text-lg">Admin Panel</span>
                <p className="text-xs text-muted-foreground">Welcome, {adminName}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="edu-card p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.totalStudents}</p>
            <p className="text-sm text-muted-foreground">Total Students</p>
          </div>
          <div className="edu-card p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
            <p className="text-2xl font-bold">{stats.totalSchools}</p>
            <p className="text-sm text-muted-foreground">Total Schools</p>
          </div>
          <div className="edu-card p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.activeSchools}</p>
            <p className="text-sm text-muted-foreground">Active Schools</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={activeTab === "schools" ? "default" : "outline"}
            onClick={() => setActiveTab("schools")}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Schools
          </Button>
          <Button
            variant={activeTab === "students" ? "default" : "outline"}
            onClick={() => setActiveTab("students")}
          >
            <Users className="w-4 h-4 mr-2" />
            Students
          </Button>
          <Button
            variant={activeTab === "reports" ? "default" : "outline"}
            onClick={() => setActiveTab("reports")}
          >
            <FileText className="w-4 h-4 mr-2" />
            Send Reports
          </Button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {activeTab === "schools" && (
            <Dialog open={showAddSchool} onOpenChange={setShowAddSchool}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Add School
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New School</DialogTitle>
                </DialogHeader>
                {generatedCredentials ? (
                  <div className="space-y-4">
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                      <p className="font-semibold text-accent mb-2">School Added Successfully!</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Share these credentials with the school:
                      </p>
                      <div className="space-y-2 bg-background rounded-lg p-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">School ID:</span>
                          <span className="font-mono font-bold">{generatedCredentials.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Password:</span>
                          <span className="font-mono font-bold">{generatedCredentials.password}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setShowAddSchool(false);
                        setGeneratedCredentials(null);
                        setNewSchool({ name: "", district: "", state: "Bihar" });
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="schoolName">School Name *</Label>
                      <Input
                        id="schoolName"
                        placeholder="Enter school name"
                        value={newSchool.name}
                        onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="district">District</Label>
                      <Input
                        id="district"
                        placeholder="e.g., Kishanganj"
                        value={newSchool.district}
                        onChange={(e) => setNewSchool({ ...newSchool, district: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        placeholder="e.g., Bihar"
                        value={newSchool.state}
                        onChange={(e) => setNewSchool({ ...newSchool, state: e.target.value })}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleAddSchool}
                      disabled={addingSchool}
                    >
                      {addingSchool ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add School
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Content */}
        {activeTab === "schools" && (
          <div className="edu-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold">Registered Schools</h2>
            </div>
            <div className="divide-y divide-border">
              {filteredSchools.map((school) => (
                <div key={school.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold">{school.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {school.school_id} • {school.district || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{school.studentCount}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                </div>
              ))}
              {filteredSchools.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No schools found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div className="edu-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold">All Students</h2>
            </div>
            <div className="divide-y divide-border">
              {filteredStudents.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold">
                      {student.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{student.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.class} • {student.school_name}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{student.parent_whatsapp}</p>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No students found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="edu-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/30">
              <h2 className="font-bold">Send Parent Reports</h2>
              <p className="text-sm text-muted-foreground">
                Send manual progress reports to parents via WhatsApp
              </p>
            </div>
            <div className="divide-y divide-border">
              {filteredStudents.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold">
                      {student.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{student.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.class} • {student.parent_whatsapp}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReport(student.id, student.parent_whatsapp)}
                    disabled={sendingReportFor === student.id}
                  >
                    {sendingReportFor === student.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Report
                      </>
                    )}
                  </Button>
                </div>
              ))}
              {filteredStudents.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No students found.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;