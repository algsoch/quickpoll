"""
AI Service using Google Gemini API
Provides poll option suggestions and sentiment analysis
"""

import os
import google.generativeai as genai
from typing import List, Optional
from backend.config import settings

# Configure Gemini API
genai.configure(api_key=settings.gemini_api_key)

# Initialize Gemini model
model = genai.GenerativeModel('gemini-pro')


async def generate_poll_options(title: str, description: str = "", num_options: int = 4) -> List[str]:
    """
    Generate poll option suggestions based on title and description using Gemini AI
    
    Args:
        title: Poll title
        description: Poll description (optional)
        num_options: Number of options to generate (default 4)
    
    Returns:
        List of suggested poll options
    """
    prompt = f"""You are a global poll expert creating diverse, thoughtful poll options for a worldwide audience.

Generate {num_options} poll options for:

Title: {title}
Description: {description if description else 'Not provided'}

CRITICAL REQUIREMENTS:
1. Options must be DIVERSE and cover different perspectives from around the world
2. Think globally - consider cultural, regional, and demographic differences
3. Each option should be 3-8 words maximum (concise but meaningful)
4. Options must be mutually exclusive (no overlap)
5. Avoid simple yes/no - provide nuanced, specific choices
6. Consider the global context of the topic

EXAMPLES OF GOOD GLOBAL OPTIONS:
- For "Best programming language": "Python for AI/ML", "JavaScript for web", "Java for enterprise", "Rust for systems"
- For "Climate action priority": "Renewable energy transition", "Carbon capture technology", "Policy and regulations", "Individual lifestyle changes"
- For "Remote work future": "Fully remote forever", "Hybrid 2-3 days office", "Return to office full-time", "Flexible per role"

Return ONLY the options, one per line, no numbers or bullets:
"""

    try:
        response = model.generate_content(prompt)
        options = [opt.strip() for opt in response.text.strip().split('\n') if opt.strip() and len(opt.strip()) > 2]
        
        # Filter out any numbering or bullets that might have slipped through
        cleaned_options = []
        for opt in options:
            # Remove common prefixes
            opt = opt.lstrip('0123456789.-•*) ')
            if opt and len(opt) <= 80:  # Max 80 chars
                cleaned_options.append(opt)
        
        # Ensure we return at least num_options
        if len(cleaned_options) < num_options:
            cleaned_options.extend([f"Option {i+1}" for i in range(len(cleaned_options), num_options)])
        
        return cleaned_options[:num_options]
    except Exception as e:
        print(f"Error generating poll options: {e}")
        # Return better fallback options
        return [
            "Strongly agree",
            "Somewhat agree", 
            "Neutral / Unsure",
            "Somewhat disagree"
        ][:num_options]


async def analyze_comment_sentiment(comment_text: str) -> dict:
    """
    Analyze sentiment of a comment using Gemini AI
    
    Args:
        comment_text: The comment text to analyze
    
    Returns:
        Dict with sentiment (positive/negative/neutral) and confidence score
    """
    prompt = f"""Analyze the sentiment of the following comment and provide:
1. Sentiment: positive, negative, or neutral
2. Confidence: a score from 0 to 1
3. Brief reason (max 20 words)

Comment: "{comment_text}"

Respond in this exact format:
Sentiment: [positive/negative/neutral]
Confidence: [0.0-1.0]
Reason: [brief explanation]
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Parse response
        lines = text.split('\n')
        sentiment = "neutral"
        confidence = 0.5
        reason = ""
        
        for line in lines:
            if line.startswith("Sentiment:"):
                sentiment = line.split(":", 1)[1].strip().lower()
            elif line.startswith("Confidence:"):
                try:
                    confidence = float(line.split(":", 1)[1].strip())
                except:
                    confidence = 0.5
            elif line.startswith("Reason:"):
                reason = line.split(":", 1)[1].strip()
        
        return {
            "sentiment": sentiment,
            "confidence": confidence,
            "reason": reason
        }
    except Exception as e:
        print(f"Error analyzing sentiment: {e}")
        return {
            "sentiment": "neutral",
            "confidence": 0.0,
            "reason": "Analysis failed"
        }


async def categorize_poll(title: str, description: str = "") -> str:
    """
    Suggest a category for a poll using Gemini AI
    
    Args:
        title: Poll title
        description: Poll description (optional)
    
    Returns:
        Suggested category
    """
    prompt = f"""Categorize the following poll into ONE of these categories:
- Technology
- Entertainment
- Sports
- Politics
- Education
- Business
- Health
- Lifestyle
- Science
- Other

Poll Title: {title}
Description: {description if description else 'Not provided'}

Respond with ONLY the category name, nothing else.
"""

    try:
        response = model.generate_content(prompt)
        category = response.text.strip()
        # Validate category
        valid_categories = ["Technology", "Entertainment", "Sports", "Politics", 
                          "Education", "Business", "Health", "Lifestyle", "Science", "Other"]
        if category in valid_categories:
            return category
        return "Other"
    except Exception as e:
        print(f"Error categorizing poll: {e}")
        return "Other"
