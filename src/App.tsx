import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader, SectionHeader } from "@/components/ui/headers";
import { MetricCard } from "@/components/ui/metric-card";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartCard } from "@/components/ui/chart-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ShimmerButton } from "@/components/ui/aceternity/shimmer-button";
import { BentoGrid, BentoGridItem } from "@/components/ui/aceternity/bento-grid";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { PageTransition, MotionHoverCard, ExpandablePanel } from "@/components/ui/motion/motion-primitives";
import { useToast } from "@/components/ui/toast";
import { Activity, Users, DollarSign, Calendar, Sparkles, Search, Plus, ArrowUpRight, ShieldCheck, HeartPulse } from "lucide-react";

const sampleChartData = [
  { label: "Mon", value: 1400 },
  { label: "Tue", value: 2100 },
  { label: "Wed", value: 1800 },
  { label: "Thu", value: 2900 },
  { label: "Fri", value: 3400 },
  { label: "Sat", value: 4100 },
  { label: "Sun", value: 3800 },
];

const sampleTableData = [
  { id: "CUST-001", name: "Ananya Sharma", pack: "Weight Loss 30D", status: "Active", daysLeft: 18, coach: "Priya M." },
  { id: "CUST-002", name: "Ramesh Verma", pack: "Muscle Gain 60D", status: "Active", daysLeft: 42, coach: "Vikram S." },
  { id: "CUST-003", name: "Kavita Reddy", pack: "Fitness Pack 15D", status: "Expiring", daysLeft: 2, coach: "Priya M." },
  { id: "CUST-004", name: "Suresh Kumar", pack: "Weight Loss 30D", status: "Expired", daysLeft: 0, coach: "Rajesh N." },
];

export function AppContent() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const { addToast } = useToast();

  const tableColumns = [
    { key: "id", header: "ID", sortable: true },
    { key: "name", header: "Customer Name", sortable: true },
    { key: "pack", header: "Membership Pack", sortable: true },
    {
      key: "status",
      header: "Status",
      render: (row: any) => (
        <Badge variant={row.status === "Active" ? "default" : row.status === "Expiring" ? "sky" : "destructive"}>
          {row.status}
        </Badge>
      ),
    },
    { key: "daysLeft", header: "Days Left", sortable: true },
    { key: "coach", header: "Assigned Coach" },
  ];

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <PageTransition key={activeTab}>
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Hero / Spotlight Header */}
            <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-8 text-white shadow-2xl border border-zinc-800">
              <Spotlight fill="#27AE60" className="-top-40 left-0 md:left-60 md:-top-20" />
              <div className="relative z-10 space-y-4 max-w-2xl">
                <Badge variant="default" className="bg-pulseGreen-500/20 text-pulseGreen-400 border border-pulseGreen-500/40">
                  PulseIQ Design Foundation v2.0
                </Badge>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Startup-Grade Component Infrastructure
                </h1>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Engineered with React, TypeScript, Tailwind CSS, shadcn/ui primitives, Motion Primitives, and Aceternity UI. Unified design tokens and zero hardcoding.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <ShimmerButton onClick={() => addToast({ title: "Design System Initialized", type: "success", description: "All 30+ UI components active!" })}>
                    Trigger System Toast
                  </ShimmerButton>
                  <Button variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800" onClick={() => setDialogOpen(true)}>
                    Open Foundation Dialog
                  </Button>
                </div>
              </div>
            </div>

            {/* Metric Stat Cards Grid */}
            <SectionHeader title="Key Analytics Overview" description="Real-time performance indicators and operational health metrics." />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard title="Active Members" value="1,248" change="+12.4%" trend="up" subtitle="vs last month" icon={<Users className="h-5 w-5" />} />
              <MetricCard title="Monthly Revenue" value="₹4,82,500" change="+8.1%" trend="up" subtitle="Target: ₹5.0L" icon={<DollarSign className="h-5 w-5" />} />
              <MetricCard title="Check-in Rate" value="94.2%" change="-1.5%" trend="down" subtitle="240 today" icon={<Calendar className="h-5 w-5" />} />
              <MetricCard title="Groq AI Insights" value="892" change="+34%" trend="up" subtitle="Diets & body scores" icon={<Sparkles className="h-5 w-5" />} />
            </div>

            {/* Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChartCard title="Weekly Attendance Trend" description="7-day daily customer check-in volume" data={sampleChartData} color="#27AE60" />
              </div>
              <div className="space-y-4">
                <SectionHeader title="Quick Stat Tiles" />
                <StatTile label="Expiring Packs" value="14 Clients" subtext="Requires renewal nudge" colorVariant="amber" />
                <StatTile label="Coach Retention" value="98.4%" subtext="12 Active coaches" colorVariant="green" />
                <StatTile label="Stock Alerts" value="2 Items Low" subtext="Shake mate & protein" colorVariant="indigo" />
              </div>
            </div>

            {/* Data Table */}
            <SectionHeader title="Active Customers Directory" description="Data table wrapper with column sorting, live searching, and status badges." />
            <DataTable data={sampleTableData} columns={tableColumns} searchPlaceholder="Search clients by name, pack, or coach..." />
          </div>
        )}

        {activeTab !== "overview" && (
          <div className="space-y-6">
            <PageHeader
              title={`${activeTab.toUpperCase()} Module`}
              description="Design foundation component showcase screen."
              actions={
                <Button variant="primary" onClick={() => addToast({ title: "Action Triggered", type: "info" })}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add New Record
                </Button>
              }
            />

            {/* Reusable UI Components Gallery */}
            <Tabs defaultValue="buttons" className="w-full">
              <TabsList className="grid grid-cols-4 max-w-xl">
                <TabsTrigger value="buttons">Buttons & Badges</TabsTrigger>
                <TabsTrigger value="forms">Forms & Inputs</TabsTrigger>
                <TabsTrigger value="cards">Cards & Bento</TabsTrigger>
                <TabsTrigger value="motion">Motion & Modals</TabsTrigger>
              </TabsList>

              {/* Buttons Tab */}
              <TabsContent value="buttons" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Button Variants</CardTitle>
                    <CardDescription>Primary, Secondary, Outline, Ghost, Danger, Success, Shimmer</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <Button variant="primary">Primary Green</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                    <Button variant="success">Success</Button>
                    <Button variant="primary" isLoading>Loading State</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Badge Variants & Avatars</CardTitle>
                    <CardDescription>Status pills, role indicators, and user avatars.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-4">
                    <Badge variant="default">Default Green</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Badge variant="sky">Sky Blue</Badge>
                    <Badge variant="indigo">Indigo Accent</Badge>
                    <div className="flex items-center gap-2 border-l border-border pl-4">
                      <Avatar><AvatarFallback>MN</AvatarFallback></Avatar>
                      <Avatar className="border-pulseGreen-500"><AvatarFallback className="bg-pulseGreen-500 text-white font-bold">AK</AvatarFallback></Avatar>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Forms Tab */}
              <TabsContent value="forms" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Form Elements</CardTitle>
                    <CardDescription>Large input controls, select dropdowns, textareas, switches, checkboxes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 max-w-lg">
                    <Input placeholder="Enter customer full name..." icon={<Users className="h-4 w-4" />} />
                    <Input placeholder="Enter email address..." error="Invalid email address format" />
                    <Select defaultValue="center-1">
                      <SelectTrigger><SelectValue placeholder="Select center..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center-1">Main Wellness Center (Center A)</SelectItem>
                        <SelectItem value="center-2">Branch Center (Center B)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea placeholder="Client health notes or diet preferences..." />
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <span className="text-sm font-medium">Automated WhatsApp Renewal Alerts</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="terms" defaultChecked />
                      <label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">Accept PulseIQ Terms & Conditions</label>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cards & Bento Tab */}
              <TabsContent value="cards" className="mt-6 space-y-6">
                <BentoGrid>
                  <BentoGridItem title="Body Composition Tracker" description="11 Karada physiological metrics logged daily." icon={<HeartPulse className="h-6 w-6 text-pulseGreen-500" />} />
                  <BentoGridItem title="Groq LLaMA 3.1 8B AI" description="7-day personalized diet plan generation engine." icon={<Sparkles className="h-6 w-6 text-pulseBlue-500" />} />
                  <BentoGridItem title="Multi-Center RLS Isolation" description="Role-based access control with center PIN security." icon={<ShieldCheck className="h-6 w-6 text-emerald-500" />} />
                </BentoGrid>

                <EmptyState
                  title="No Pending Approvals"
                  description="All coach registrations and center payment receipts have been verified."
                  primaryActionLabel="Create New Entry"
                  onPrimaryAction={() => addToast({ title: "New Entry Modal", type: "info" })}
                />
              </TabsContent>

              {/* Motion & Modals Tab */}
              <TabsContent value="motion" className="mt-6 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Motion Primitives & Accordion</CardTitle>
                    <CardDescription>Expandable panels, interactive hover cards, smooth accordions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" onClick={() => setPanelOpen(!panelOpen)}>
                      Toggle Expandable Motion Panel
                    </Button>
                    <ExpandablePanel isOpen={panelOpen}>
                      <div className="p-4 rounded-xl bg-muted/60 text-sm text-foreground">
                        This expandable panel animates with Framer Motion spring physics (&lt;300ms duration).
                      </div>
                    </ExpandablePanel>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>What is the PulseIQ Architecture?</AccordionTrigger>
                        <AccordionContent>
                          PulseIQ combines a React + TypeScript frontend with Supabase PostgreSQL, Chart.js analytics, and Groq LLM serverless proxy functions.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-2">
                        <AccordionTrigger>How does Dark Mode work?</AccordionTrigger>
                        <AccordionContent>
                          Dark mode is driven by CSS custom properties mapped to Tailwind Zinc neutrals (`zinc-50` and `zinc-950`).
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Foundation Dialog Demo */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>UI Design System Foundation</DialogTitle>
                  <DialogDescription>
                    All components comply with WCAG AA contrast standards, keyboard navigation, focus management, and dark mode support.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 text-sm text-muted-foreground">
                  Ready to connect business modules (Customers, Attendance, Body Comp, Finance, Inventory, Groq AI).
                </div>
                <DialogFooter>
                  <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirm & Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </PageTransition>
    </AppLayout>
  );
}

export default AppContent;
