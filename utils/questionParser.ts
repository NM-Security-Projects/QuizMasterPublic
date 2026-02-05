
import { Question } from '../types';

export const cleanMatchText = (text: string) => {
  // Removes "A. " or "1. " prefixes if they exist in the text body
  return text.replace(/^[\w]+[\.\)]\s*/, '').trim();
};

export const isMatch = (questionText: string) => {
  return /\[MATCH\]/i.test(questionText);
};

export const isMultiSelect = (question: Question) => {
  // Priority 1: Explicit tag in text
  if (/\[MULTI\]/i.test(question.question_text)) return true;
  if (isMatch(question.question_text)) return false;
  
  // Priority 2: Comma in answer key
  const correct = (question.correct_answer || "").trim().toUpperCase();
  if (correct.includes(',')) return true;
  
  // Priority 3: Multiple letters (e.g. "ABC") if choices exist
  const keys = Object.keys(question.choices);
  if (correct.length > 1 && keys.length > 0) {
      const chars = correct.split('');
      // Only treat as multi if all chars are valid keys (avoids "None" or "All")
      return chars.every(c => keys.includes(c));
  }
  return false;
};

export interface MatchConfig {
  leftItems: string[]; // The items to match (Text)
  rightChoices: string[]; // The available options (Keys)
  correctLinks: Set<string>; // "Text||Key" format
  isValid: boolean;
}

export const parseMatchConfiguration = (question: Question): MatchConfig => {
  const correctStr = question.correct_answer || "";
  
  // 1. Extract Identifiers and Map Choices
  // Map: Identifier (First char) -> List of Choices
  const idToChoices: Record<string, { key: string, text: string }[]> = {};
  
  Object.entries(question.choices).forEach(([key, val]) => {
      const cleanVal = String(val).trim();
      if (!cleanVal) return;
      
      // Strict First Character Identifier as requested
      const id = cleanVal.charAt(0).toUpperCase();
      
      if (!idToChoices[id]) idToChoices[id] = [];
      // Use cleanMatchText to store the display text without prefix
      idToChoices[id].push({ key, text: cleanMatchText(cleanVal) });
  });

  // 2. Parse Answer Key Pairs to determine Left/Right layout
  const leftIds = new Set<string>();
  const rightIds = new Set<string>();
  const validPairs: [string, string][] = [];

  // Handle newlines and commas. 
  // Supports "A,1" or "1,A" formats order-independently relative to the line itself
  const lines = correctStr.replace(/\\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  
  lines.forEach(line => {
      // Split by comma
      const parts = line.split(',').map(s => s.trim().replace(/['"]/g, '').toUpperCase());
      
      // We look for pairs. 
      // Logic: The first item in the pair goes Left, the second goes Right.
      if (parts.length >= 2) {
          // Extract just the ID char from the key if it was verbose (e.g. "1. Something")
          const id1 = parts[0].charAt(0); 
          const id2 = parts[1].charAt(0);
          
          if (idToChoices[id1] && idToChoices[id2]) {
              leftIds.add(id1);
              rightIds.add(id2);
              validPairs.push([id1, id2]);
          }
      }
  });

  // 3. Build UI Lists
  const leftItems: string[] = [];
  const rightChoices: string[] = [];
  const correctLinks = new Set<string>();

  // Sort Keys Naturally (1 vs 10 vs 2, A vs B)
  const sortedLeftIds = Array.from(leftIds).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const sortedRightIds = Array.from(rightIds).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Populate Left Column Items (Text) - Ordered by ID Sequence
  sortedLeftIds.forEach(id => {
      const choices = idToChoices[id];
      if (choices) {
          // If multiple items map to same ID (edge case), preserve partial order
          choices.forEach(c => leftItems.push(c.text));
      }
  });

  // Populate Right Column Choices (Keys) - Ordered by ID Sequence
  sortedRightIds.forEach(id => {
      const choices = idToChoices[id];
      if (choices) {
          choices.forEach(c => rightChoices.push(c.key));
      }
  });

  // 4. Build Correct Links (LeftText || RightKey)
  // This format matches what QuizInterface expects for validation
  validPairs.forEach(([lId, rId]) => {
      const lChoices = idToChoices[lId];
      const rChoices = idToChoices[rId];
      
      if (lChoices && rChoices) {
          // Create Cartesian product of valid connections
          lChoices.forEach(lc => {
              rChoices.forEach(rc => {
                  correctLinks.add(`${lc.text}||${rc.key}`);
              });
          });
      }
  });

  // Fallback: If parsing failed (no valid pairs found), validation will fail gracefully
  return {
      leftItems,
      rightChoices,
      correctLinks,
      isValid: correctLinks.size > 0
  };
};

export const checkAnswerCorrectness = (question: Question, selectedOption: string | string[] | null): boolean => {
  if (selectedOption === null) return false;

  if (isMatch(question.question_text)) {
      const config = parseMatchConfiguration(question);
      if (!config.isValid) return false;
      
      const userLinks = Array.isArray(selectedOption) ? selectedOption : [];
      const userSet = new Set(userLinks);
      
      // Strict Equality: 
      // 1. User must have found the exact number of links required
      // 2. All user links must be valid
      if (userSet.size !== config.correctLinks.size) return false;
      
      for (const link of userSet) {
          if (!config.correctLinks.has(link)) return false;
      }
      return true;
  }

  const correctStr = (question.correct_answer || "").trim().toUpperCase();
  let correctOptions: string[] = [];
  
  // Determine correct keys based on comma separation or string splitting
  if (correctStr.includes(',')) {
      correctOptions = correctStr.split(',').map(s => s.trim().replace(/['"]/g, ''));
  } else if (isMultiSelect(question) && correctStr.length > 1) {
      // If tagged [MULTI] but answer is "AC", treat as ["A", "C"]
      correctOptions = correctStr.split('');
  } else {
      correctOptions = [correctStr];
  }

  if (isMultiSelect(question)) {
      const selections = Array.isArray(selectedOption) ? selectedOption : [selectedOption as string];
      const userSet = new Set(selections);
      const correctSet = new Set(correctOptions);
      
      return userSet.size === correctSet.size && [...userSet].every(v => correctSet.has(v));
  }

  // Single Choice
  const userSelection = Array.isArray(selectedOption) ? selectedOption[0] : selectedOption;
  return userSelection === correctOptions[0];
};
