CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_date date NOT NULL,
  order_index smallint NOT NULL CHECK (order_index BETWEEN 1 AND 3),
  category text NOT NULL,
  text text NOT NULL,
  choices jsonb NOT NULL,
  correct_index smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation text,
  UNIQUE (unlock_date, order_index)
);
CREATE INDEX quiz_questions_date_idx ON public.quiz_questions (unlock_date);

CREATE TABLE public.quiz_answers (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  choice_index smallint NOT NULL CHECK (choice_index BETWEEN -1 AND 3),
  points smallint NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, question_id)
);
CREATE INDEX quiz_answers_player_idx ON public.quiz_answers (player_id);

CREATE OR REPLACE VIEW public.quiz_leaderboard AS
SELECT
  p.id AS player_id,
  p.display_name,
  p.avatar,
  COALESCE(SUM(a.points), 0)::int AS total_points,
  COUNT(*) FILTER (WHERE a.choice_index <> -1) AS answered,
  COUNT(*) FILTER (WHERE a.choice_index <> -1 AND a.points > 0) AS correct
FROM public.players p
LEFT JOIN public.quiz_answers a ON a.player_id = p.id
GROUP BY p.id, p.display_name, p.avatar;

ALTER VIEW public.quiz_leaderboard SET (security_invoker = on);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_answers read all" ON public.quiz_answers FOR SELECT USING (true);

GRANT SELECT ON public.quiz_answers TO anon, authenticated;
GRANT SELECT ON public.quiz_leaderboard TO anon, authenticated;
GRANT ALL ON public.quiz_questions, public.quiz_answers TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;

INSERT INTO public.quiz_questions (unlock_date, order_index, category, text, choices, correct_index, explanation) VALUES
('2026-06-26', 1, 'winners', 'Who won the inaugural 1930 World Cup?', '["Argentina","Brazil","Italy","Uruguay"]'::jsonb, 3, 'Uruguay hosted and won the first World Cup, beating Argentina 4-2 in the final in Montevideo.'),
('2026-06-26', 2, 'scorers', 'France''s Just Fontaine scored a record 13 goals at the 1958 World Cup. Who finished second in the all-time single-tournament list with 11 goals in 1954?', '["Sándor Kocsis","Pelé","Gerd Müller","Garrincha"]'::jsonb, 0, 'Hungary''s Sándor Kocsis scored 11 in 1954. Fontaine''s 13 in 1958 still stands as the single-tournament record.'),
('2026-06-26', 3, 'moments', 'In which year did Maradona score his famous "Hand of God" goal against England?', '["1982","1986","1990","1994"]'::jsonb, 1, 'Argentina vs England, World Cup 1986 quarter-final. Four minutes after the handball, Maradona scored his "Goal of the Century" in the same match.'),
('2026-06-27', 1, 'winners', 'Who won the 1934 World Cup, hosted in Italy?', '["Czechoslovakia","Hungary","Italy","Spain"]'::jsonb, 2, 'Italy beat Czechoslovakia 2-1 in extra time at the final in Rome.'),
('2026-06-27', 2, 'scorers', 'Who was the top scorer at the 1970 World Cup with 10 goals?', '["Gerd Müller","Pelé","Jairzinho","Tostão"]'::jsonb, 0, 'West Germany''s Gerd Müller won the Golden Boot with 10 goals in Mexico 1970.'),
('2026-06-27', 3, 'moments', 'Brazil suffered their heaviest WC defeat, losing 1-7 in the 2014 semi-final to which team?', '["Argentina","France","Germany","Netherlands"]'::jsonb, 2, 'Germany dismantled Brazil 7-1 in Belo Horizonte en route to winning the 2014 World Cup.'),
('2026-06-28', 1, 'winners', 'Italy won back-to-back World Cups in 1934 and which other year?', '["1930","1938","1950","1954"]'::jsonb, 1, 'Italy beat Hungary 4-2 in the 1938 final in Colombes, France, becoming the first repeat champion.'),
('2026-06-28', 2, 'scorers', 'Who was the top scorer at the 1986 World Cup with 6 goals?', '["Diego Maradona","Careca","Gary Lineker","Emilio Butragueño"]'::jsonb, 2, 'England''s Gary Lineker won the Golden Boot at Mexico 1986 with six goals.'),
('2026-06-28', 3, 'moments', 'Pelé became the youngest goalscorer in WC history at what age?', '["17","18","19","20"]'::jsonb, 0, 'Pelé was 17 years and 239 days old when he scored against Wales in 1958.'),
('2026-06-29', 1, 'winners', 'Uruguay shocked Brazil 2-1 in the 1950 final round at the Maracanã. Who scored Uruguay''s winning goal?', '["Alcides Ghiggia","Juan Schiaffino","Obdulio Varela","Atilio García"]'::jsonb, 0, 'Alcides Ghiggia''s 79th-minute strike sealed the so-called "Maracanaço".'),
('2026-06-29', 2, 'records', 'Who is the only player to win three World Cups?', '["Diego Maradona","Pelé","Franz Beckenbauer","Lionel Messi"]'::jsonb, 1, 'Pelé won in 1958, 1962 and 1970 with Brazil — still the only player to lift the trophy three times.'),
('2026-06-29', 3, 'iran', 'In which year did Iran first qualify for a World Cup?', '["1974","1978","1982","1990"]'::jsonb, 1, 'Iran debuted at Argentina 1978 under coach Heshmat Mohajerani.'),
('2026-06-30', 1, 'winners', '"The Miracle of Bern" was who beating an unbeaten Hungary 3-2 in the 1954 final?', '["Brazil","Italy","Sweden","West Germany"]'::jsonb, 3, 'West Germany came back from 0-2 down to win 3-2 against a Hungary side unbeaten in 31 matches.'),
('2026-06-30', 2, 'scorers', 'Who was the top scorer at the 1998 World Cup with 6 goals?', '["Christian Vieri","Davor Šuker","Gabriel Batistuta","Ronaldo"]'::jsonb, 1, 'Croatia''s Davor Šuker won the Golden Boot at France 1998 with six goals.'),
('2026-06-30', 3, 'iran', 'Iran''s first ever World Cup goal in 1978 was scored against which team?', '["Netherlands","Peru","Scotland","Tunisia"]'::jsonb, 2, 'Iraj Danaeifard equalised for Iran in a 1-1 draw with Scotland — Iran''s first World Cup goal.'),
('2026-07-01', 1, 'winners', 'Who won the 1958 World Cup, with a 17-year-old Pelé scoring twice in the final?', '["Brazil","France","Sweden","West Germany"]'::jsonb, 0, 'Brazil beat hosts Sweden 5-2 in Solna for their first title.'),
('2026-07-01', 2, 'wc26', 'How many host countries does the 2026 World Cup have?', '["1","2","3","4"]'::jsonb, 2, 'Canada, Mexico and the United States co-host — a first for a men''s World Cup.'),
('2026-07-01', 3, 'tidbits', 'The 1986 World Cup in Mexico had a mascot that was an anthropomorphic what?', '["Cactus","Jalapeño pepper","Sombrero","Sun"]'::jsonb, 1, 'Pique was a jalapeño pepper wearing a sombrero — a nod to Mexican cuisine and dress.'),
('2026-07-02', 1, 'winners', 'Who won the 1966 World Cup, their only World Cup title?', '["England","Italy","Portugal","West Germany"]'::jsonb, 0, 'England beat West Germany 4-2 at Wembley after extra time. Geoff Hurst''s hat-trick remains the only one in a final by an Englishman.'),
('2026-07-02', 2, 'scorers', 'Who was the top scorer at the 2002 World Cup with 8 goals?', '["Christian Vieri","Miroslav Klose","Rivaldo","Ronaldo"]'::jsonb, 3, 'Brazil''s Ronaldo won the Golden Boot at Korea/Japan 2002 with eight goals, including both in the final.'),
('2026-07-02', 3, 'moments', 'Roger Milla, the oldest WC goalscorer, was how old when he scored at USA 1994?', '["38","40","42","44"]'::jsonb, 2, 'Milla was 42 years, 1 month and 8 days old when he scored against Russia — a record that still stands.'),
('2026-07-03', 1, 'winners', 'Argentina won their first World Cup in 1978 — but who captained their second title in 1986?', '["Daniel Passarella","Diego Maradona","Jorge Burruchaga","Mario Kempes"]'::jsonb, 1, 'Maradona captained Argentina to victory in Mexico 1986, leaving the trophy raised over his head at the Azteca.'),
('2026-07-03', 2, 'scorers', 'Who was the top scorer at the 2006 World Cup with 5 goals?', '["Hernán Crespo","Lukas Podolski","Miroslav Klose","Thierry Henry"]'::jsonb, 2, 'Germany''s Miroslav Klose won the Golden Boot at home with five goals.'),
('2026-07-03', 3, 'iran', 'Iran''s historic 2-1 win over which country at the 1998 World Cup is still cited as a major upset?', '["Germany","United States","Yugoslavia","Mexico"]'::jsonb, 1, 'Iran beat the USA 2-1 in Lyon — their first ever World Cup victory. Hamid Estili and Mehdi Mahdavikia scored.'),
('2026-07-04', 1, 'winners', 'Who won the 1998 World Cup on home soil?', '["Brazil","Croatia","France","Italy"]'::jsonb, 2, 'France beat Brazil 3-0 in the final at the Stade de France. Zinedine Zidane scored twice.'),
('2026-07-04', 2, 'records', 'Who scored the most goals across all World Cups, after the 2022 tournament?', '["Gerd Müller","Just Fontaine","Lionel Messi","Miroslav Klose"]'::jsonb, 3, 'Miroslav Klose finished his WC career with 16 goals. Lionel Messi has since surpassed him during the 2026 cycle.'),
('2026-07-04', 3, 'tidbits', 'Which 2010 official match ball was famously criticised by players for unpredictable flight?', '["Brazuca","Fevernova","Jabulani","Teamgeist"]'::jsonb, 2, 'Goalkeepers were especially vocal about the Jabulani''s erratic movement at altitude in South Africa.'),
('2026-07-05', 1, 'winners', 'Brazil''s 2002 World Cup triumph saw them beat which team 2-0 in the final?', '["Germany","South Korea","Spain","Turkey"]'::jsonb, 0, 'Brazil beat Germany 2-0 in Yokohama with two goals from Ronaldo.'),
('2026-07-05', 2, 'scorers', 'Who was the top scorer at the 2014 World Cup with 6 goals?', '["James Rodríguez","Lionel Messi","Neymar","Thomas Müller"]'::jsonb, 0, 'Colombia''s James Rodríguez won the Golden Boot at Brazil 2014, including a famous volley vs Uruguay.'),
('2026-07-05', 3, 'wc26', 'The 2026 World Cup final will be played at MetLife Stadium in which US state?', '["California","Florida","New Jersey","New York"]'::jsonb, 2, 'MetLife Stadium is in East Rutherford, New Jersey, just across the Hudson from New York City.'),
('2026-07-06', 1, 'winners', 'Spain won their only World Cup in 2010, beating which side 1-0 in the final?', '["Germany","Netherlands","Paraguay","Uruguay"]'::jsonb, 1, 'Andrés Iniesta scored deep in extra time vs the Netherlands at Soccer City, Johannesburg.'),
('2026-07-06', 2, 'scorers', 'Who was the top scorer at the 2018 World Cup with 6 goals?', '["Antoine Griezmann","Cristiano Ronaldo","Harry Kane","Romelu Lukaku"]'::jsonb, 2, 'England''s Harry Kane won the Golden Boot at Russia 2018, including a hat-trick against Panama.'),
('2026-07-06', 3, 'moments', 'Hakan Şükür scored the fastest goal in World Cup history. In how many seconds?', '["8","11","15","22"]'::jsonb, 1, 'Şükür scored after just 11 seconds in Turkey vs South Korea (3rd place playoff) at Korea/Japan 2002.'),
('2026-07-07', 1, 'winners', 'Who won the 2022 World Cup in Qatar?', '["Argentina","Brazil","Croatia","France"]'::jsonb, 0, 'Argentina beat France 4-2 on penalties after a 3-3 draw at Lusail Stadium — Messi''s long-awaited first WC title.'),
('2026-07-07', 2, 'scorers', 'Who was the top scorer at the 2022 World Cup with 8 goals?', '["Julian Álvarez","Kylian Mbappé","Lionel Messi","Olivier Giroud"]'::jsonb, 1, 'Mbappé won the Golden Boot at Qatar 2022, including a hat-trick in the final.'),
('2026-07-07', 3, 'iran', 'Which coach has led Iran at four different World Cups?', '["Branko Ivanković","Carlos Queiroz","Heshmat Mohajerani","Jalal Talebi"]'::jsonb, 1, 'Carlos Queiroz has coached Iran at 2014, 2018, 2022 and 2026 — by far the longest WC run for any Team Melli boss.'),
('2026-07-08', 1, 'scorers', 'Who was the top scorer at the 1966 World Cup with 9 goals, nicknamed "The Black Panther"?', '["Bobby Charlton","Eusébio","Ferenc Bene","Franz Beckenbauer"]'::jsonb, 1, 'Portugal''s Eusébio won the Golden Boot at England 1966, including four against North Korea in a 5-3 comeback.'),
('2026-07-08', 2, 'records', 'Which country has appeared at every single World Cup, 1930-2026?', '["Argentina","Brazil","Germany","Italy"]'::jsonb, 1, 'Brazil is the only nation to have appeared in all 23 World Cup tournaments.'),
('2026-07-08', 3, 'tidbits', 'The iconic black-and-white 32-panel Telstar match ball debuted at which World Cup?', '["1966","1970","1974","1978"]'::jsonb, 1, 'Adidas''s Telstar was used at Mexico 1970, the first WC broadcast in colour worldwide — the design helped it stand out on TV.'),
('2026-07-09', 1, 'scorers', 'Italy''s Paolo Rossi won the 1982 Golden Boot with 6 goals — including a hat-trick against which team in the second round?', '["Argentina","Brazil","Poland","West Germany"]'::jsonb, 1, 'Rossi''s hat-trick in Italy''s 3-2 win over Brazil in Barcelona is one of the great individual performances in WC history.'),
('2026-07-09', 2, 'wc26', 'The 2026 World Cup opening match will be played at Estadio Azteca in which city?', '["Guadalajara","Mexico City","Monterrey","Tijuana"]'::jsonb, 1, 'The opening match is at the storied Estadio Azteca in Mexico City — the only stadium to host two WC finals (1970, 1986).'),
('2026-07-09', 3, 'moments', 'Geoff Hurst''s hat-trick in the 1966 final was scored against which country?', '["Argentina","Brazil","Hungary","West Germany"]'::jsonb, 3, 'England beat West Germany 4-2 after extra time at Wembley. Hurst was the only player with a WC final hat-trick until Mbappé in 2022.'),
('2026-07-10', 1, 'scorers', 'Mario Kempes won the 1978 Golden Boot with 6 goals — for which country?', '["Argentina","Brazil","Italy","Netherlands"]'::jsonb, 0, 'Kempes was a star of Argentina''s first WC title and scored twice in the final against the Netherlands.'),
('2026-07-10', 2, 'records', 'Just Fontaine scored a record 13 goals at a single World Cup — in which year?', '["1950","1954","1958","1962"]'::jsonb, 2, 'Fontaine scored 13 in 6 matches at Sweden 1958 — a single-tournament record that has never come close to being beaten.'),
('2026-07-10', 3, 'iran', 'In which year did Iran achieve their best ever group stage performance, finishing with 1W-1D-1L?', '["1998","2006","2018","2022"]'::jsonb, 2, 'Iran beat Morocco 1-0, lost narrowly to Spain 0-1, and drew 1-1 with Portugal at Russia 2018.'),
('2026-07-11', 1, 'records', 'The biggest WC match win came in 1982. Hungary 10, who 1?', '["El Salvador","Honduras","Kuwait","New Zealand"]'::jsonb, 0, 'Hungary thrashed El Salvador 10-1 in their group at Spain 1982.'),
('2026-07-11', 2, 'moments', 'Until Mbappé equalled the feat in 2022, only one player had scored a hat-trick in a WC final. Who?', '["Diego Maradona","Geoff Hurst","Pelé","Vavá"]'::jsonb, 1, 'Geoff Hurst''s hat-trick at Wembley in 1966 stood alone for 56 years.'),
('2026-07-11', 3, 'wc26', 'How many teams are competing in the expanded 2026 World Cup?', '["32","40","48","64"]'::jsonb, 2, 'The 2026 World Cup is the first to use the new 48-team format, up from 32.'),
('2026-07-12', 1, 'records', 'Which nation holds the longest current WC unbeaten run, with 14 matches between 2014 and 2026?', '["Argentina","Brazil","Germany","Netherlands"]'::jsonb, 3, 'The Netherlands'' unbeaten run reached 14 matches at the start of the 2026 World Cup.'),
('2026-07-12', 2, 'iran', 'Iran''s biggest WC defeat came at the 2022 group stage. The score was 2-6 against which team?', '["England","Spain","United States","Wales"]'::jsonb, 0, 'Iran lost 6-2 to England in their opening match at Qatar 2022.'),
('2026-07-12', 3, 'tidbits', 'The 1998 World Cup mascot was a rooster in French colours. What was its name?', '["Ciao","Footix","Naranjito","Striker"]'::jsonb, 1, 'Footix — the rooster (Gallic symbol) — was the mascot at France 1998.'),
('2026-07-13', 1, 'hosts', 'The Maracanã hosted the WC final in 1950 — and which other year?', '["1994","2002","2010","2014"]'::jsonb, 3, 'The Maracanã hosted the 2014 final, where Germany beat Argentina 1-0 in extra time.'),
('2026-07-13', 2, 'moments', 'Zidane''s infamous 2006 final headbutt struck which Italian defender?', '["Fabio Cannavaro","Gianluca Zambrotta","Marco Materazzi","Andrea Pirlo"]'::jsonb, 2, 'Zidane head-butted Materazzi''s chest in extra time and was sent off. Italy went on to win on penalties.'),
('2026-07-13', 3, 'wc26', 'How many total matches will be played at the expanded 2026 World Cup?', '["64","80","104","128"]'::jsonb, 2, '104 matches: 72 group-stage games plus 32 in the new R32 → R16 → QF → SF → F + 3rd place knockout bracket.'),
('2026-07-14', 1, 'hosts', 'The Estadio Azteca hosted the WC final in 1970 — and which other year?', '["1974","1982","1986","1990"]'::jsonb, 2, 'Mexico City''s Azteca hosted the famous 1986 final where Argentina beat West Germany 3-2.'),
('2026-07-14', 2, 'iran', 'Iran''s most-capped WC player Ehsan Hajsafi made his WC debut at which tournament?', '["2010","2014","2018","2022"]'::jsonb, 1, 'Hajsafi played at Brazil 2014, Russia 2018, Qatar 2022 and now USA/Mex/Can 2026.'),
('2026-07-14', 3, 'records', 'The biggest score in a WC final remains a 5-2 win in 1958. Brazil beat which side?', '["Czechoslovakia","Italy","Sweden","West Germany"]'::jsonb, 2, 'Brazil beat hosts Sweden 5-2 in Solna at the 1958 final.'),
('2026-07-15', 1, 'hosts', 'The 1994 World Cup final was played at the Rose Bowl in which US state?', '["California","Florida","New Jersey","Texas"]'::jsonb, 0, 'Pasadena, California hosted the final — Brazil beat Italy on penalties after a 0-0 draw.'),
('2026-07-15', 2, 'moments', 'The "Miracle of Bern" was West Germany''s 1954 final comeback win against an unbeaten Hungary, then on a streak of how many games unbeaten?', '["18","23","31","40"]'::jsonb, 2, 'Hungary entered the final unbeaten in 31 international matches — and lost 3-2 to West Germany.'),
('2026-07-15', 3, 'tidbits', 'The 2006 World Cup official match ball was named what?', '["Brazuca","Jabulani","Teamgeist","Tricolore"]'::jsonb, 2, 'Adidas''s Teamgeist had 14 panels — the first WC ball to drop from the traditional 32.'),
('2026-07-16', 1, 'hosts', 'The 2010 World Cup, held in South Africa, had its final at Soccer City Stadium in which city?', '["Cape Town","Durban","Johannesburg","Pretoria"]'::jsonb, 2, 'Soccer City in Johannesburg hosted the 2010 final — Spain 1, Netherlands 0 (a.e.t.).'),
('2026-07-16', 2, 'iran', 'Iran''s win over Wales 2-0 at Qatar 2022 was their first ever WC clean sheet. The match was in which group?', '["Group A","Group B","Group C","Group D"]'::jsonb, 1, 'Iran were in Group B with England, USA and Wales. Their 2-0 win over Wales was sealed in stoppage time.'),
('2026-07-16', 3, 'records', 'Which player holds the record for most World Cup appearances, with 26?', '["Lionel Messi","Lothar Matthäus","Miroslav Klose","Sergio Ramos"]'::jsonb, 0, 'Lionel Messi reached 26 WC appearances in 2026, surpassing Lothar Matthäus (25).'),
('2026-07-17', 1, 'hosts', 'The 1974 World Cup was hosted by West Germany. Where was the final played?', '["Berlin","Frankfurt","Munich","Hamburg"]'::jsonb, 2, 'The Olympiastadion in Munich hosted the final — West Germany beat the Netherlands 2-1.'),
('2026-07-17', 2, 'moments', 'The "Group of Death" nickname has been used at many World Cups. Which 1986 group is often cited as the original?', '["Brazil, USSR, Spain, Northern Ireland","Argentina, Italy, Bulgaria, Korea Republic","West Germany, Denmark, Uruguay, Scotland","England, Poland, Portugal, Morocco"]'::jsonb, 2, 'West Germany, Denmark, Uruguay and Scotland at Mexico 1986 is often called the original "Group of Death".'),
('2026-07-17', 3, 'tidbits', 'The 2014 World Cup mascot was an armadillo named what?', '["Fuleco","Zakumi","Goleo","Naranjito"]'::jsonb, 0, 'Fuleco was a Brazilian three-banded armadillo.'),
('2026-07-18', 1, 'hosts', 'The 1982 World Cup was held in Spain. The final was played at which stadium?', '["Santiago Bernabéu","Camp Nou","Vicente Calderón","San Mamés"]'::jsonb, 0, 'Italy beat West Germany 3-1 at the Santiago Bernabéu in Madrid.'),
('2026-07-18', 2, 'records', 'The first player to score in four different World Cup tournaments was?', '["Pelé","Miroslav Klose","Cristiano Ronaldo","Uwe Seeler"]'::jsonb, 3, 'Uwe Seeler scored in 1958, 1962, 1966 and 1970 for West Germany.'),
('2026-07-18', 3, 'iran', 'Iran''s 2026 World Cup qualification was confirmed via which route?', '["AFC round-robin","AFC playoffs + inter-confed playoff","Host nation","AFC final tournament"]'::jsonb, 1, 'Iran finished second in AFC qualifying and then beat a CONMEBOL side in an inter-confederation playoff.'),
('2026-07-19', 1, 'winners', 'Which country has won the most World Cups?', '["Argentina","Brazil","Germany","Italy"]'::jsonb, 1, 'Brazil have won five World Cups (1958, 1962, 1970, 1994, 2002).'),
('2026-07-19', 2, 'moments', 'Which goalkeeper saved three penalties in the 2022 World Cup final shootout?', '["Dominik Livaković","Emiliano Martínez","Hugo Lloris","Wojciech Szczęsny"]'::jsonb, 1, 'Emiliano Martínez saved Coman and Tchouaméni in the final shootout, then taunted Kolo Muani before the final save.'),
('2026-07-19', 3, 'wc26', 'How many host cities does the 2026 World Cup have across the three countries?', '["16","20","22","24"]'::jsonb, 2, 'There are 16 host cities in total: 11 in the USA, 3 in Mexico, and 2 in Canada.');
