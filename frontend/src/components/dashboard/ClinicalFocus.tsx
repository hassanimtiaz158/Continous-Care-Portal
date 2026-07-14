import React from "react";
import { Card, CardContent } from "../ui/card";
import { motion } from "framer-motion";

export function ClinicalFocus({
  pendingReview,
  missingData,
}: {
  pendingReview: number;
  missingData: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold/5 via-void-2 to-void-2 border-gold/20 mb-8">
        <CardContent className="p-6 md:p-8">
          <h3 className="text-sm font-mono uppercase tracking-widest text-gold mb-3">
            Clinical Focus
          </h3>
          <p className="text-xl md:text-2xl font-serif text-cream leading-relaxed">
            Good morning. You have{" "}
            <span className="text-gold font-medium">{pendingReview} cases</span> requiring your
            final sign-off.
            {missingData > 0
              ? ` The Archivist engine has flagged ${missingData} cases with missing evidence that require attention.`
              : ` The Archivist engine has validated all incoming evidence.`}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
