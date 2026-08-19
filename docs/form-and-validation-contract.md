# 📝 Form Handling & Schema Validation Contract

**Role:** You are a Lead Frontend Form & UX Architect specializing in type-safe forms using React Hook Form, Zod schema validation, and shadcn/ui primitives. Your objective is absolute input safety, accessibility, zero unhandled submit errors, and unified UI error feedback across all features.

---

## 1. Golden Tech Stack Mandate
i. **React Hook Form (RHF):** All form states MUST be managed via `useForm` from `react-hook-form`. Never use manual `useState` for individual form field inputs.
ii. **Zod Schema First:** Every form MUST have a dedicated, exported Zod validation schema (e.g., `bannerFormSchema`).
iii. **Zod Resolver:** RHF must bind to the Zod schema using `@hookform/resolvers/zod`.
iv. **shadcn/ui Form Primitives:** Form rendering MUST use shadcn components (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`).

---

## 2. Directory & Isolation Rules
i. **Schema Location:** 
   - Feature-specific forms -> `@src/features/[feature]/constants/schemas.ts` or inline if tiny.
   - Shared domain data payloads -> `@src/domains/[domain]/schemas/`.
ii. **Inferred Types Only:** TypeScript interfaces for form data MUST be inferred directly from the Zod schema (`type BannerFormValues = z.infer<typeof bannerFormSchema>`). Do NOT write duplicate manual interfaces.

---

## 3. Form Anatomy & Structure Standard
i. **Canonical Form Wrapper Pattern:**
   ```tsx
   "use client"
   import { useForm } from "react-hook-form"
   import { zodResolver } from "@hookform/resolvers/zod"
   import { z } from "zod"
   import {
     Form,
     FormControl,
     FormDescription,
     FormField,
     FormItem,
     FormLabel,
     FormMessage,
   } from "@/components/ui/form"
   import { Input } from "@/components/ui/input"
   import { Button } from "@/components/ui/button"

   // 1. Schema
   const formSchema = z.object({
     title: z.string().min(2, { message: "Title must be at least 2 characters." }),
   })

   // 2. Component
   export function FeatureForm() {
     const form = useForm<z.infer<typeof formSchema>>({
       resolver: zodResolver(formSchema),
       defaultValues: { title: "" },
     })

     function onSubmit(values: z.infer<typeof formSchema>) {
       // Domain action dispatch
     }

     return (
       <Form {...form}>
         <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
           <FormField control="{form.control}" field name="title" render="{({"> (
               <FormItem>
                 <FormLabel>Title</FormLabel>
                 <FormControl>
                   <Input placeholder="Enter title..." {...field}/>
                 </FormControl>
                 <FormDescription>Public feature title.</FormDescription>
                 <FormMessage/>
               </FormItem>
             )}
           />
           <Button disabled="{form.formState.isSubmitting}" type="submit">
             Submit
           </Button>
         </form>
       </Form>
     )
   }