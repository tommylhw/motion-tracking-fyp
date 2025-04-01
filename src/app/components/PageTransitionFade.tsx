'use client';
import React from 'react';
import { motion } from 'framer-motion';

const PageTransitionFade = ({children}: {children: React.ReactNode}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        ease: 'easeInOut',
        duration: 0.75,
      }}
    >
      {children}
    </motion.div>
  )
}

export default PageTransitionFade